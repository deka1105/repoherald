import { sql, type SQL } from "drizzle-orm";
import { users } from "@/db/schema";

/**
 * How to name a user in public, now that not every account has a GitHub login.
 *
 * Deliberately does NOT fall back to the email local part: a comment byline is
 * public, and "jane.doe" next to a known domain is most of an address. An
 * account with neither a login nor a name shows "member", which says nothing
 * about them.
 */
export function displayNameSql(): SQL<string> {
  return sql<string>`coalesce(nullif(${users.githubLogin}, ''), nullif(${users.name}, ''), 'member')`;
}

/** Client-side twin: "@octocat" for GitHub accounts, a plain name otherwise. */
export function formatHandle(login: string | null, name: string): string {
  return login ? `@${login}` : name;
}
