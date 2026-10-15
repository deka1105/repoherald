import "server-only";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { findLinkTarget, type UserRole } from "@/lib/account-link";
import { bootstrapAdminLogins, computeMintEligible } from "@/lib/github-user";
import { isPrimaryAdminEmail } from "@/lib/primary-admins";
import { grantWelcomeCredit } from "@/lib/credits";

export type AppUser = {
  id: string;
  role: UserRole;
  githubLogin: string | null;
};

/**
 * Map a Clerk user onto a row in `users`, creating or linking one as needed.
 *
 * Clerk owns identity; this table still owns everything the product cares
 * about — role, credit balance, mint eligibility, lists, claimed handles — so
 * sign-in resolves to a local row rather than replacing it.
 *
 * Linking: an account that existed before Clerk has no clerk_user_id, so the
 * first Clerk sign-in finds it by verified email and adopts it. That is how the
 * existing users keep their credits and admin role without being imported.
 * Only verified addresses are matched — see findLinkTarget.
 *
 * Idempotent, and the unique constraint on clerk_user_id is what makes it safe
 * to call on every request rather than only at sign-in.
 */
export async function resolveClerkUser(clerkUserId: string): Promise<AppUser | null> {
  const [existing] = await db
    .select({ id: users.id, role: users.role, githubLogin: users.githubLogin })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  if (existing) return existing;

  return provisionFromClerk(clerkUserId);
}

async function provisionFromClerk(clerkUserId: string): Promise<AppUser | null> {
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkUserId).catch(() => null);
  if (!clerkUser) return null;

  // Only an address Clerk itself marks verified may link to an existing
  // account. An unverified one would let anyone who can type an address walk
  // into the account that owns it.
  const primary = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  );
  const verifiedEmail =
    primary?.verification?.status === "verified" ? primary.emailAddress : null;

  const github = clerkUser.externalAccounts.find(
    (a) => a.provider === "oauth_github" || a.provider === "github"
  );
  const githubId = github?.externalId ? Number(github.externalId) : null;
  const githubLogin = github?.username ?? null;

  const target = await findLinkTarget({
    githubId: Number.isFinite(githubId) ? githubId : null,
    verifiedEmail,
  });

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

  const values = {
    clerkUserId,
    name,
    ...(verifiedEmail ? { email: verifiedEmail } : {}),
    ...(githubId && Number.isFinite(githubId) ? { githubId } : {}),
    ...(githubLogin ? { githubLogin } : {}),
  };

  if (target) {
    const [row] = await db
      .update(users)
      .set({
        ...values,
        // Re-asserted on adoption, not just at creation: a primary admin who
        // was demoted — or whose row predates the configuration — comes back
        // as an admin rather than staying wherever the table left them.
        ...(isPrimaryAdminEmail(verifiedEmail) ? { role: "admin" as const } : {}),
      })
      .where(eq(users.id, target.id))
      .returning({ id: users.id, role: users.role, githubLogin: users.githubLogin });
    return row;
  }

  // Two ways to be an admin before anyone has clicked anything: a configured
  // GitHub login, or a configured address. The login route is unreachable for
  // a Google-only sign-in, which is why the address route exists.
  const isBootstrapAdmin =
    (githubLogin ? bootstrapAdminLogins().has(githubLogin.toLowerCase()) : false) ||
    isPrimaryAdminEmail(verifiedEmail);

  // Mint eligibility needs GitHub profile age and footprint, which Clerk does
  // not carry. Default to false; the nightly sync and a GitHub-backed action
  // can raise it later. Granting it blind would hand out credits.
  const [row] = await db
    .insert(users)
    .values({
      ...values,
      avatarUrl: clerkUser.imageUrl || null,
      role: isBootstrapAdmin ? "admin" : "user",
      mintEligible: false,
    })
    .returning({ id: users.id, role: users.role, githubLogin: users.githubLogin });

  return row;
}

/** Re-export so callers do not need to know where the heuristic lives. */
export { computeMintEligible, grantWelcomeCredit };
