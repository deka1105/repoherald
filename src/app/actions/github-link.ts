"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { getGithubToken } from "@/lib/github-token";
import { fetchViewer } from "@/lib/github";
import { computeMintEligible } from "@/lib/github-user";
import { writeAudit } from "@/lib/audit";

export type LinkState = { error?: string; ok?: string };

/**
 * Copy a GitHub connection made in Clerk onto the local row.
 *
 * This has to exist as its own step because resolveClerkUser() reads Clerk's
 * external accounts only when it first provisions a row. Every later request
 * takes the fast path keyed on clerk_user_id, so a GitHub account connected
 * after sign-up would never reach github_id / github_login and the connection
 * would appear to do nothing at all.
 *
 * Safe to run repeatedly — it is also how a changed GitHub username gets
 * picked up.
 */
export async function syncGithubFromClerk(): Promise<LinkState> {
  const user = await requireUser();

  const clerkUser = await currentUser();
  const external = clerkUser?.externalAccounts.find(
    (a) => a.provider === "oauth_github" || a.provider === "github"
  );
  if (!external?.externalId) {
    return { error: "No GitHub account is connected to your login yet." };
  }

  const githubId = Number(external.externalId);
  if (!Number.isFinite(githubId)) {
    return { error: "GitHub returned an id we couldn't read. Try again." };
  }

  // github_id is UNIQUE: one GitHub account belongs to one member. Catching it
  // here turns a constraint violation into an explanation.
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.githubId, githubId), ne(users.id, user.id)))
    .limit(1);
  if (taken) {
    return {
      error:
        "That GitHub account is already connected to another repoherald " +
        "member. Disconnect it there first.",
    };
  }

  // The token only resolves once Clerk holds the connection, so this doubles
  // as proof the connection really works rather than merely being recorded.
  const token = await getGithubToken(user.id);
  const profile = token ? await fetchViewer(token).catch(() => null) : null;

  await db
    .update(users)
    .set({
      githubId,
      githubLogin: profile?.login ?? external.username ?? null,
      // Only touched when GitHub actually answered. A failed profile read
      // should not quietly mark somebody ineligible.
      ...(profile
        ? {
            mintEligible: computeMintEligible(profile),
            githubCreatedAt: new Date(profile.created_at),
            githubPublicRepos: profile.public_repos,
            githubFollowers: profile.followers,
            // A fresh Clerk-held token means any earlier revocation is moot.
            tokenInvalidAt: null,
          }
        : {}),
    })
    .where(eq(users.id, user.id));

  await writeAudit(db, {
    actorUserId: user.id,
    actorType: "user",
    action: "account.github.linked",
    entityType: "user",
    entityId: user.id,
    metadata: { githubId, login: profile?.login ?? external.username ?? null },
  });

  revalidatePath("/account");
  return {
    ok: profile
      ? `Connected as @${profile.login}.`
      : "GitHub connected. We couldn't read your profile just now, so credit eligibility will be worked out later.",
  };
}
