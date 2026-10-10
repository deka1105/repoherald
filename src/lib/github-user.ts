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

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { encryptToken } from "@/lib/crypto";
import { grantWelcomeCredit } from "@/lib/credits";

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

  const [row] = await db
    .insert(users)
    .values({
      ...values,
      githubId: p.id,
      role: isBootstrapAdmin ? "admin" : "user",
    })
    .onConflictDoUpdate({
      target: users.githubId,
      // Non-bootstrap sign-ins leave role untouched so moderators and
      // dashboard-granted admins aren't demoted on their next sign-in.
      set: isBootstrapAdmin ? { ...values, role: "admin" } : values,
    })
    // xmax = 0 marks a freshly inserted row (vs. an ON CONFLICT update),
    // so the welcome bonus fires exactly once, on first sign-in.
    .returning({
      id: users.id,
      role: users.role,
      isNew: sql<boolean>`(xmax = 0)`,
    });

  if (row.isNew && values.mintEligible) {
    await grantWelcomeCredit(row.id);
  }

  return { id: row.id, role: row.role, githubLogin: p.login };
}
