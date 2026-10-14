import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { findLinkTarget, type UserRole } from "@/lib/account-link";

export type GoogleProfile = {
  sub: string;
  email?: string | null;
  email_verified?: boolean;
  name?: string | null;
  picture?: string | null;
};

/**
 * Insert or update the user behind a Google sign-in.
 *
 * Unlike the GitHub path this grants no welcome credit and sets no mint
 * eligibility. Credits are minted from verified GitHub stars, which needs a
 * GitHub token — a Google-only account cannot earn them, so handing one a
 * balance it has no way to have earned would be a lie in the ledger.
 *
 * Nothing here can make somebody an admin. ADMIN_GITHUB_LOGINS bootstraps by
 * GitHub login, deliberately: a Google address is not a thing this app has
 * ever used to decide authority.
 */
export async function upsertGoogleUser(
  p: GoogleProfile
): Promise<{ id: string; role: UserRole; githubLogin: string | null }> {
  // Only link on an address Google says it verified. An unverified one would
  // let anyone who can type an address walk into the account that owns it.
  const email = p.email_verified === true ? (p.email?.trim() || null) : null;

  const target = await findLinkTarget({ googleId: p.sub, verifiedEmail: email });

  const values = {
    googleId: p.sub,
    name: p.name ?? null,
    ...(email ? { email } : {}),
  };

  if (target) {
    // Avatar is NOT overwritten: an existing GitHub account already has one,
    // and the Google picture would replace it on every sign-in.
    const [row] = await db
      .update(users)
      .set(values)
      .where(eq(users.id, target.id))
      .returning({ id: users.id, role: users.role, githubLogin: users.githubLogin });
    return { id: row.id, role: row.role, githubLogin: row.githubLogin };
  }

  const [row] = await db
    .insert(users)
    .values({ ...values, avatarUrl: p.picture ?? null, role: "user" })
    .returning({ id: users.id, role: users.role, githubLogin: users.githubLogin });
  return { id: row.id, role: row.role, githubLogin: row.githubLogin };
}
