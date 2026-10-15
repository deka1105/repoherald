import "server-only";

/**
 * Accounts that are admins because of configuration, not because of a row.
 *
 * `ADMIN_GITHUB_LOGINS` already bootstraps admins, but it is keyed on a GitHub
 * login — and since identity moved to Clerk, somebody who signs in with Google
 * has no GitHub login at all, so that door is shut to them. These addresses are
 * the way in for the accounts that run the site.
 *
 * "Primary" means two things, and the second is the point:
 *
 *  1. Signing in with one of these VERIFIED addresses grants admin, on first
 *     sign-in and on every later one, so the role cannot drift away from the
 *     configuration.
 *  2. The role cannot be changed from /admin/users. Without that, any admin
 *     could demote the owner, and `setUserRole` only ever stopped you demoting
 *     *yourself*. An account that the site's operator cannot lose is worth
 *     more than one more button that works.
 *
 * Kept in env rather than in the database on purpose: a DB write should not be
 * able to hand out admin, and the list survives a restore of an older dump.
 */
export function primaryAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Only ever called with an address Clerk has marked verified — an unverified
 * one would make admin available to anyone who can type it.
 */
export function isPrimaryAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return primaryAdminEmails().has(email.trim().toLowerCase());
}
