"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, repoCategories, repos, reports } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { decryptToken } from "@/lib/crypto";
import { writeAudit } from "@/lib/audit";
import {
  fetchRepoByFullName,
  fetchRepoLanguages,
  isOrgMember,
} from "@/lib/github";

const URL_RE = /^(?:https?:\/\/)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i;

const REPO_POSTS_PER_DAY = 5;

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Create user-supplied categories (comma-separated labels) and return their ids. */
async function createUserCategories(
  kind: "use_case" | "sector",
  raw: string
): Promise<string[]> {
  const labels = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 40)
    .slice(0, 3);
  const ids: string[] = [];
  for (const label of labels) {
    const slug = slugify(label);
    if (!slug) continue;
    const [row] = await db
      .insert(categories)
      .values({ kind, slug, label })
      .onConflictDoNothing()
      .returning({ id: categories.id });
    if (row) {
      ids.push(row.id);
    } else {
      // Already exists (maybe deactivated) — reuse it if active.
      const existing = await db.query.categories.findFirst({
        where: and(
          eq(categories.kind, kind),
          eq(categories.slug, slug),
          eq(categories.isActive, true)
        ),
      });
      if (existing) ids.push(existing.id);
    }
  }
  return ids;
}

export type PostRepoState = { error?: string };

export async function postRepo(
  _prev: PostRepoState,
  formData: FormData
): Promise<PostRepoState> {
  const user = await requireUser();
  // githubLogin is in the guard because GitHub is now optional: a Gmail-only
  // account has no login and no token, and everything below this line needs
  // both. Checking it here also narrows the type for the rest of the function.
  if (!user.githubLogin || !user.githubAccessTokenEnc || user.tokenInvalidAt) {
    return {
      error: user.githubLogin
        ? "Your GitHub session is stale — please sign in again."
        : "Connect your GitHub account first — this needs it.",
    };
  }

  // Listing spam guard: same UTC-day window as the claim caps. Admins exempt.
  if (user.role !== "admin") {
    const [{ postedToday }] = await db
      .select({ postedToday: sql<number>`count(*)::int` })
      .from(repos)
      .where(
        and(
          eq(repos.postedByUserId, user.id),
          gte(repos.createdAt, sql`date_trunc('day', now())`)
        )
      );
    if (postedToday >= REPO_POSTS_PER_DAY) {
      return {
        error: `Daily posting limit reached (${REPO_POSTS_PER_DAY}/day) — try again tomorrow.`,
      };
    }
  }

  const url = String(formData.get("url") ?? "").trim();
  const match = URL_RE.exec(url);
  if (!match) return { error: "Enter a GitHub repo URL like github.com/owner/name." };
  const [, ownerLogin, repoName] = match;

  const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);

  const token = decryptToken(user.githubAccessTokenEnc);
  const ghRepo = await fetchRepoByFullName(token, ownerLogin, repoName);
  if (!ghRepo) return { error: "Repo not found on GitHub (or you can't access it)." };
  if (ghRepo.private) return { error: "Only public repos can be listed." };

  // Only owners (or org members) may list a repo — prevents listing other
  // people's projects and the takedown disputes that follow. Admins are exempt.
  const ownsIt =
    user.role === "admin" ||
    ghRepo.owner.login.toLowerCase() === user.githubLogin.toLowerCase() ||
    (ghRepo.owner.type === "Organization" &&
      (await isOrgMember(token, ghRepo.owner.login)));
  if (!ownsIt) {
    return { error: "You can only post repos you own or belong to (org member)." };
  }

  const newUseCaseIds = await createUserCategories(
    "use_case",
    String(formData.get("newUseCases") ?? "")
  );
  const newSectorIds = await createUserCategories(
    "sector",
    String(formData.get("newSectors") ?? "")
  );

  let validCategoryIds: string[] = [];
  {
    const allIds = [...new Set([...categoryIds, ...newUseCaseIds, ...newSectorIds])];
    if (allIds.length > 0) {
      const cats = await db
        .select()
        .from(categories)
        .where(and(inArray(categories.id, allIds), eq(categories.isActive, true)));
      for (const kind of ["use_case", "sector"] as const) {
        if (cats.filter((c) => c.kind === kind).length > 3) {
          return { error: "Pick at most 3 categories per group (including new ones)." };
        }
      }
      validCategoryIds = cats.map((c) => c.id);
    }
  }

  const languages = await fetchRepoLanguages(token, ghRepo.owner.login, ghRepo.name);

  const [inserted] = await db
    .insert(repos)
    .values({
      githubRepoId: ghRepo.id,
      fullName: ghRepo.full_name,
      ownerLogin: ghRepo.owner.login,
      name: ghRepo.name,
      description: ghRepo.description,
      primaryLanguage: ghRepo.language,
      languages,
      starsCount: ghRepo.stargazers_count,
      avatarUrl: ghRepo.owner.avatar_url,
      isArchived: ghRepo.archived,
      postedByUserId: user.id,
      lastSyncedAt: new Date(),
    })
    .onConflictDoNothing({ target: repos.githubRepoId })
    .returning({ id: repos.id });

  if (!inserted) return { error: "This repo is already listed." };

  if (validCategoryIds.length > 0) {
    await db.insert(repoCategories).values(
      validCategoryIds.map((categoryId) => ({ repoId: inserted.id, categoryId }))
    );
  }

  await writeAudit(db, {
    actorUserId: user.id,
    actorType: "user",
    action: "listing.create",
    entityType: "repo",
    entityId: inserted.id,
    metadata: { fullName: ghRepo.full_name },
  });

  revalidatePath("/");
  redirect(`/repos/${inserted.id}`);
}

export async function reportRepo(repoId: string, reason: string) {
  const user = await requireUser();
  const repo = await db.query.repos.findFirst({ where: eq(repos.id, repoId) });
  if (!repo) throw new Error("Repo not found");
  await db.insert(reports).values({
    repoId,
    reporterUserId: user.id,
    reason: reason.slice(0, 500) || "No reason given",
  });
  await writeAudit(db, {
    actorUserId: user.id,
    actorType: "user",
    action: "listing.report",
    entityType: "repo",
    entityId: repoId,
  });
}
