"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { requireGithub } from "@/lib/github-token";
import { repos, starMints, users } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { CreditError, mintCredit } from "@/lib/credits";
import { GithubAuthError, getStarredAt, isStarred } from "@/lib/github";

export type ClaimState = { error?: string; success?: string };

export async function claimStar(repoId: string): Promise<ClaimState> {
  const user = await requireUser();

  const eligible =
    user.eligibilityOverride === "allowed" ||
    (user.eligibilityOverride !== "blocked" && user.mintEligible);
  if (!eligible) {
    return {
      error:
        "Your GitHub account doesn't meet the minimum activity requirements to earn credits yet.",
    };
  }
  // One shared gate: a login plus a token that actually resolves, for Clerk
  // web users and mobile alike. See requireGithub().
  const gate = await requireGithub(user);
  if (!gate.ok) return { error: gate.error };

  const repo = await db.query.repos.findFirst({ where: eq(repos.id, repoId) });
  if (!repo || repo.status !== "active") {
    return { error: "This listing isn't active." };
  }
  if (
    repo.postedByUserId === user.id ||
    repo.ownerLogin.toLowerCase() === gate.githubLogin.toLowerCase()
  ) {
    return { error: "You can't earn credits for starring your own repo." };
  }

  const existing = await db.query.starMints.findFirst({
    where: and(eq(starMints.userId, user.id), eq(starMints.repoId, repoId)),
  });
  if (existing) {
    return { error: "You've already claimed this star — each repo counts once." };
  }

  try {
    const starred = await isStarred(gate.token, repo.ownerLogin, repo.name);
    if (!starred) {
      return {
        error: "We couldn't find your star. Star the repo on GitHub, then claim.",
      };
    }
    const starredAt = await getStarredAt(token, repo.githubRepoId);
    if (!starredAt || starredAt < repo.createdAt) {
      return {
        error:
          "Only stars given after the repo was listed here earn credits — this star predates the listing.",
      };
    }

    const mintId = await mintCredit(user.id, repoId, repo.githubRepoId);
    if (!mintId) {
      return { error: "You've already claimed this star — each repo counts once." };
    }
  } catch (e) {
    if (e instanceof GithubAuthError) {
      await db
        .update(users)
        .set({ tokenInvalidAt: new Date() })
        .where(eq(users.id, user.id));
      return { error: "Your GitHub session expired — please sign in again." };
    }
    if (e instanceof CreditError) return { error: e.message };
    throw e;
  }

  revalidatePath(`/repos/${repoId}`);
  revalidatePath("/wallet");
  return { success: "Star verified — 1 credit added to your wallet." };
}
