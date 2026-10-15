import "server-only";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { decryptToken } from "@/lib/crypto";

/**
 * The GitHub access token to act as a given user with, or null.
 *
 * There are two sources, because there are two ways to sign in:
 *
 *   Clerk — the web. Clerk holds the OAuth token and refreshes it, so it is
 *           tried first and is the fresher of the two.
 *   Local — the mobile app, which runs its own GitHub OAuth against
 *           /api/mobile/v1/session and stores the token encrypted here. Clerk
 *           never sees that sign-in, so a mobile-only account has no Clerk
 *           token and this fallback is the only one it has.
 *
 * Returns null rather than throwing when the user simply has no GitHub
 * connected, which is now an ordinary state rather than an error.
 */
export async function getGithubToken(userId: string): Promise<string | null> {
  const [row] = await db
    .select({
      clerkUserId: users.clerkUserId,
      tokenEnc: users.githubAccessTokenEnc,
      tokenInvalidAt: users.tokenInvalidAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;

  if (row.clerkUserId) {
    try {
      const client = await clerkClient();
      const res = await client.users.getUserOauthAccessToken(
        row.clerkUserId,
        "github"
      );
      const token = res.data?.[0]?.token;
      if (token) return token;
    } catch {
      // A Clerk outage or a user with no GitHub connection both land here.
      // Fall through to the stored token rather than failing outright.
    }
  }

  if (row.tokenEnc && !row.tokenInvalidAt) return decryptToken(row.tokenEnc);
  return null;
}

export type GithubGate =
  | { ok: true; token: string; githubLogin: string }
  | { ok: false; error: string };

/**
 * The guard every GitHub-backed action needs: a login AND a usable token.
 *
 * It exists because the obvious version of this check was wrong in three
 * places at once. Each action tested `users.github_access_token_enc`, which is
 * the token this app encrypts itself — and since identity moved to Clerk, web
 * users do not have one. Clerk holds their token. So the guard rejected
 * everybody on the web before the Clerk-aware lookup below it ever ran, and
 * posting, star claims and issue reports were all dead.
 *
 * Resolving the token IS the check: getGithubToken() asks Clerk first and
 * falls back to the locally encrypted token for mobile, and already refuses a
 * token marked invalid. Returning the token rather than a boolean means the
 * caller cannot forget to use the same one it just validated.
 */
export async function requireGithub(user: {
  id: string;
  githubLogin: string | null;
}): Promise<GithubGate> {
  if (!user.githubLogin) {
    return { ok: false, error: "Connect your GitHub account first — this needs it." };
  }
  const token = await getGithubToken(user.id);
  if (!token) {
    return { ok: false, error: "Your GitHub session is stale — please sign in again." };
  }
  return { ok: true, token, githubLogin: user.githubLogin };
}
