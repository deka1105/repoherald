import "server-only";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export type UserRole = "user" | "moderator" | "admin";

/**
 * Find the account a sign-in belongs to, across providers.
 *
 * Order matters. A provider id is proof: it is the same account we saw last
 * time. An email address is only a link *hint* — it says "a human with this
 * verified address already has an account here", which is why the caller must
 * pass it ONLY when the provider marked it verified. Matching on an
 * unverified address would let anyone who can claim an address at sign-up walk
 * into someone else's account.
 *
 * Returns null for a genuinely new person.
 */
export async function findLinkTarget(opts: {
  githubId?: number | null;
  googleId?: string | null;
  /** Pass only if the provider says it is verified. */
  verifiedEmail?: string | null;
}): Promise<{ id: string; role: UserRole } | null> {
  const clauses = [];
  if (opts.githubId != null) clauses.push(eq(users.githubId, opts.githubId));
  if (opts.googleId) clauses.push(eq(users.googleId, opts.googleId));
  if (opts.verifiedEmail) clauses.push(eq(users.email, opts.verifiedEmail));
  if (clauses.length === 0) return null;

  const rows = await db
    .select({
      id: users.id,
      role: users.role,
      githubId: users.githubId,
      googleId: users.googleId,
    })
    .from(users)
    .where(clauses.length === 1 ? clauses[0] : or(...clauses));

  if (rows.length === 0) return null;

  // A provider-id hit wins over an email hit, so that a user whose email
  // changed elsewhere still lands in their own account rather than a stranger's
  // that happens to now hold the old address.
  const byProvider = rows.find(
    (r) =>
      (opts.githubId != null && r.githubId === opts.githubId) ||
      (opts.googleId && r.googleId === opts.googleId)
  );
  const hit = byProvider ?? rows[0];
  return { id: hit.id, role: hit.role };
}
