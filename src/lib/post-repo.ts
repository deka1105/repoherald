/**
 * Listing a repo, shared by the web form and the mobile API.
 *
 * Extracted from `src/app/actions/repos.ts` so `/api/mobile/v1/repos` enforces
 * the same rules. The one that matters most is the ownership check: only the
 * owner, or a member of the owning org, may list a repo. Anything that let the
 * app bypass it would turn into the takedown disputes that check exists to
 * prevent.
 *
 * The caller supplies the user, parses its own input shape and decides what to
 * do with the new id — a redirect on the web, a JSON body on mobile.
 */
import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { requireGithub } from "@/lib/github-token";
import { categories, repoCategories, repos } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import {
  fetchRepoByFullName,
  fetchRepoLanguages,
  isOrgMember,
} from "@/lib/github";

const URL_RE = /^(?:https?:\/\/)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i;

export const REPO_POSTS_PER_DAY = 5;
/** Per group (use case, sector) — new and existing categories counted together. */
export const MAX_CATEGORIES_PER_GROUP = 3;

export type PostRepoInput = {
  url: string;
  categoryIds: string[];
  /** Comma-separated free-text labels the poster typed. */
  newUseCases: string;
  newSectors: string;
};

export type PostRepoResult = { error: string } | { repoId: string };

type Poster = { id: string; role: string; githubLogin: string | null };

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
    .slice(0, MAX_CATEGORIES_PER_GROUP);
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

export async function postRepoFor(
  user: Poster,
  input: PostRepoInput
): Promise<PostRepoResult> {
  // One shared gate: a login plus a token that actually resolves, for Clerk
  // web users and mobile alike. See requireGithub().
  const gate = await requireGithub(user);
  if (!gate.ok) return { error: gate.error };

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

  const match = URL_RE.exec(input.url.trim());
  if (!match) return { error: "Enter a GitHub repo URL like github.com/owner/name." };
  const [, ownerLogin, repoName] = match;

  const ghRepo = await fetchRepoByFullName(gate.token, ownerLogin, repoName);
  if (!ghRepo) return { error: "Repo not found on GitHub (or you can't access it)." };
  if (ghRepo.private) return { error: "Only public repos can be listed." };

  // Only owners (or org members) may list a repo — prevents listing other
  // people's projects and the takedown disputes that follow. Admins are exempt.
  const ownsIt =
    user.role === "admin" ||
    ghRepo.owner.login.toLowerCase() === gate.githubLogin.toLowerCase() ||
    (ghRepo.owner.type === "Organization" &&
      (await isOrgMember(gate.token, ghRepo.owner.login)));
  if (!ownsIt) {
    return { error: "You can only post repos you own or belong to (org member)." };
  }

  const newUseCaseIds = await createUserCategories("use_case", input.newUseCases);
  const newSectorIds = await createUserCategories("sector", input.newSectors);

  let validCategoryIds: string[] = [];
  {
    const allIds = [
      ...new Set([...input.categoryIds, ...newUseCaseIds, ...newSectorIds]),
    ];
    if (allIds.length > 0) {
      const cats = await db
        .select()
        .from(categories)
        .where(and(inArray(categories.id, allIds), eq(categories.isActive, true)));
      for (const kind of ["use_case", "sector"] as const) {
        if (cats.filter((c) => c.kind === kind).length > MAX_CATEGORIES_PER_GROUP) {
          return {
            error: `Pick at most ${MAX_CATEGORIES_PER_GROUP} categories per group (including new ones).`,
          };
        }
      }
      validCategoryIds = cats.map((c) => c.id);
    }
  }

  const languages = await fetchRepoLanguages(gate.token, ghRepo.owner.login, ghRepo.name);

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

  return { repoId: inserted.id };
}
