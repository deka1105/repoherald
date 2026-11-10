import { sql, type SQL } from "drizzle-orm";
import { users } from "@/db/schema";

/**
 * How to name a user in public, now that not every account has a GitHub login.
 *
 * The username comes first: every account has one, it is unique, and it is
 * what the person chose (or was given) to be called here — see
 * src/lib/username.ts. The GitHub login stays as the next fallback for the
 * window in which an account predating the column has not signed in yet.
 *
 * Deliberately does NOT fall back to the email local part: a comment byline is
 * public, and "jane.doe" next to a known domain is most of an address. An
 * account with none of the above shows "member", which says nothing about
 * them. Note that `name` — a real name, from the identity provider — now ranks
 * below the username for the same reason: a handle discloses less than the
 * name on somebody's Google account, and before usernames existed that name
 * was what a Google-only account's byline showed.
 */
export function displayNameSql(): SQL<string> {
  return sql<string>`coalesce(nullif(${users.username}, ''), nullif(${users.githubLogin}, ''), nullif(${users.name}, ''), 'member')`;
}

/**
 * Client-side twin: "@octocat" for anything handle-shaped, a plain name
 * otherwise. Pass the username in preference to the GitHub login — both are
 * handles, and the username is the one every account has.
 */
export function formatHandle(handle: string | null, name: string): string {
  return handle ? `@${handle}` : name;
}
