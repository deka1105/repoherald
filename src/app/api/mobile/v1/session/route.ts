import { NextResponse } from "next/server";
import { verifyToken } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { resolveClerkUser, grantWelcomeCredit } from "@/lib/clerk-user";
import { mintMobileToken } from "@/lib/mobile-auth";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Exchange a Clerk session token for a repoherald bearer token.
 *
 * The app signs in with Clerk (@clerk/expo) exactly as the web does, rather
 * than running its own GitHub OAuth as it used to. Two reasons, and the second
 * is the one that forced it:
 *
 *   - Identity stays in one place. A GitHub-only device sign-in created rows
 *     Clerk had never seen, so the same human could end up as two accounts.
 *   - App Store Guideline 4.8 requires an app that offers third-party login to
 *     also offer a privacy-preserving option. Through Clerk, enabling Sign in
 *     with Apple is a dashboard switch; through a hand-rolled GitHub flow it
 *     would have been a second OAuth implementation in the client.
 *
 * Why still exchange for our own token instead of sending the Clerk token on
 * every call: a Clerk session token lives about a minute, so every endpoint
 * would have to tolerate refresh races, and `getToken()` throws when offline.
 * Ours lasts 30 days and is verified without a network hop or a database read
 * (src/lib/mobile-auth.ts). The Clerk token is proof of identity, used once.
 *
 * The token is verified against Clerk — never trusted — because anyone can
 * POST a string.
 */
export async function POST(req: Request) {
  let clerkToken: string | undefined;
  try {
    ({ clerkToken } = (await req.json()) as { clerkToken?: string });
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!clerkToken) {
    return NextResponse.json({ error: "missing_clerk_token" }, { status: 400 });
  }

  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) {
    // Without the key there is nothing to verify the signature against, and a
    // token we cannot check must never be accepted.
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  // No `authorizedParties`: that option checks the `azp` claim, which carries
  // the browser Origin of the request that minted the token. A native client
  // has no origin, so the claim is absent and pinning it would reject every
  // real device. Signature, issuer and expiry are what prove this token.
  let clerkUserId: string;
  try {
    const claims = await verifyToken(clerkToken, { secretKey });
    if (!claims?.sub) throw new Error("no subject");
    clerkUserId = claims.sub;
  } catch (e) {
    log.info("mobile.session.token_rejected", { reason: String(e) });
    return NextResponse.json({ error: "clerk_rejected_token" }, { status: 401 });
  }

  // The same resolution the web takes on every request, so a person who signs
  // in on both platforms lands on one row — including adoption of a pre-Clerk
  // account by verified email.
  const user = await resolveClerkUser(clerkUserId);
  if (!user) {
    return NextResponse.json({ error: "user_unresolved" }, { status: 401 });
  }

  // Unchanged from the GitHub-era route: a brand-new account gets the welcome
  // credit, an adopted one does not. See AppUser.created.
  if (user.created) await grantWelcomeCredit(user.id);

  const minted = mintMobileToken(user.id);
  if (!minted) {
    // AUTH_SECRET missing — refuse rather than issue a forgeable token.
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const [row] = await db
    .select({
      githubLogin: users.githubLogin,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return NextResponse.json({
    version: 1,
    token: minted.token,
    expiresAt: minted.expiresAt,
    user: {
      id: user.id,
      githubLogin: row?.githubLogin ?? null,
      name: row?.name ?? null,
      avatarUrl: row?.avatarUrl ?? null,
    },
  });
}
