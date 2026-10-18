/**
 * Upserting a GitHub user, shared by the web and mobile sign-in paths.
 *
 * This lives here rather than in `src/auth.ts` because there are now two ways
 * in: the Auth.js `jwt` callback (web) and `POST /api/mobile/v1/session`
 * (mobile). Both must apply the *same* eligibility heuristic and grant the
 * welcome credit on exactly the same condition. Two copies of this logic would
 * drift, and the thing that drifts is who gets free credits — so there is one
 * copy and both callers use it.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { encryptToken } from "@/lib/crypto";
import { grantWelcomeCredit } from "@/lib/credits";
import { findLinkTarget } from "@/lib/account-link";

export type GithubProfile = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  created_at: string;
  public_repos: number;
  followers: number;
};

// Eligibility heuristic against throwaway accounts: 90+ days old, or 30+ days
// with a real footprint (3+ public repos and 2+ followers).
export function computeMintEligible(p: GithubProfile): boolean {
  const ageDays = (Date.now() - new Date(p.created_at).getTime()) / 86_400_000;
  if (ageDays >= 90) return true;
  return ageDays >= 30 && p.public_repos >= 3 && p.followers >= 2;
}

export function bootstrapAdminLogins(): Set<string> {
  return new Set(
    (process.env.ADMIN_GITHUB_LOGINS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Insert or update the user behind a GitHub profile, and grant the welcome
 * credit on first sign-in only.
 *
 * Returns the user's id, role and github login — what a session needs.
 *
 * @deprecated No longer called. Its one caller was the mobile session route,
 * which now signs in through Clerk like the web (App Store Guideline 4.8 wants
 * a privacy-preserving login option alongside GitHub, and Clerk makes Sign in
 * with Apple a dashboard switch). Provisioning therefore goes through
 * `resolveClerkUser`. Kept because it is the only description of the pre-Clerk
 * GitHub-identity path, which the `users` rows it created still reflect.
 */
export async function upsertGithubUser(
  p: GithubProfile,
  accessToken: string
): Promise<{ id: string; role: "user" | "moderator" | "admin"; githubLogin: string }> {
  const isBootstrapAdmin = bootstrapAdminLogins().has(p.login.toLowerCase());
  const values = {
    githubLogin: p.login,
    name: p.name,
    email: p.email,
    avatarUrl: p.avatar_url,
    githubAccessTokenEnc: encryptToken(accessToken),
    tokenInvalidAt: null,
    githubCreatedAt: new Date(p.created_at),
    githubPublicRepos: p.public_repos,
    githubFollowers: p.followers,
    mintEligible: computeMintEligible(p),
  };

  // Link rather than insert when this person already has an account — either
  // the same GitHub id as before, or a verified email matching an account they
  // made with Google. Without this, connecting GitHub to a Gmail account would
  // silently create a second account holding none of their lists or credits.
  //
  // GitHub only lets a *verified* address be the profile email, and Auth.js
  // falls back to the primary verified address from /user/emails, so p.email is
  // safe to link on.
  const target = await findLinkTarget({ githubId: p.id, verifiedEmail: p.email });

  if (target) {
    const [row] = await db
      .update(users)
      .set(
        isBootstrapAdmin
          ? { ...values, githubId: p.id, role: "admin" as const }
          : { ...values, githubId: p.id }
      )
      .where(eq(users.id, target.id))
      .returning({ id: users.id, role: users.role });
    return { id: row.id, role: row.role, githubLogin: p.login };
  }

  const [row] = await db
    .insert(users)
    .values({
      ...values,
      githubId: p.id,
      role: isBootstrapAdmin ? "admin" : "user",
    })
    .returning({ id: users.id, role: users.role });

  // First sign-in, so the welcome bonus fires exactly once.
  if (values.mintEligible) {
    await grantWelcomeCredit(row.id);
  }

  return { id: row.id, role: row.role, githubLogin: p.login };
}
