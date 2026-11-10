import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  checkUsername,
  FALLBACK_USERNAME_PREFIX,
  generateUsername,
  usernameFromGithubLogin,
} from "@/lib/username";

/**
 * Assigning and changing the public handle. The rules it enforces are pure and
 * live in src/lib/username.ts; what is here is the part that needs the table.
 */

/**
 * Did Postgres reject this write because the handle is taken?
 *
 * 23505 is unique_violation. The only statements this module runs are
 * single-row updates that set `username` and nothing else, so on those
 * statements 23505 can only mean the username index — which is why the code
 * alone is enough here and must not be reused as a general-purpose check.
 */
function isUsernameTaken(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  return code === "23505";
}

/** How many generated candidates to try before falling back to the row id. */
const MAX_GENERATED_ATTEMPTS = 6;

/**
 * Give an account a handle if it does not have one. Returns the handle in
 * force afterwards, or null if the row is gone.
 *
 * Called on sign-in rather than by a webhook, so there is no window in which
 * somebody is signed in without a handle — the same reasoning that puts
 * `resolveClerkUser` on the request path. It is also how the accounts that
 * predate the column get one even if the backfill migration missed them.
 *
 * Idempotent and safe against two concurrent sign-ins: every update carries
 * `AND username IS NULL`, so the loser of a race updates no rows and reads
 * back the winner's handle instead of overwriting it.
 */
export async function ensureUsername(
  userId: string,
  hints: { githubLogin?: string | null } = {}
): Promise<string | null> {
  const seed = usernameFromGithubLogin(hints.githubLogin);

  // The GitHub login first, then progressively less pretty generated names.
  // Attempt 0 is a bare `silent-otter`; later attempts add four digits.
  const candidates = [
    ...(seed ? [seed] : []),
    ...Array.from({ length: MAX_GENERATED_ATTEMPTS }, (_, i) =>
      generateUsername(Math.random, i)
    ),
    // Last resort, and the reason the loop can always terminate: the row id is
    // already unique, so this candidate cannot collide. `member-` is reserved
    // from manual claims precisely so it stays available to this line.
    `${FALLBACK_USERNAME_PREFIX}${userId.replace(/-/g, "").slice(0, 12)}`,
  ];

  for (const candidate of candidates) {
    try {
      const [row] = await db
        .update(users)
        .set({ username: candidate })
        .where(and(eq(users.id, userId), isNull(users.username)))
        .returning({ username: users.username });
      if (row?.username) return row.username;

      // No row updated: either this account already has a handle (a concurrent
      // sign-in won) or it no longer exists. Both are answered by reading it.
      return await currentUsername(userId);
    } catch (e) {
      if (!isUsernameTaken(e)) throw e;
      // Taken — try the next, less likely, candidate.
    }
  }

  return currentUsername(userId);
}

async function currentUsername(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.username ?? null;
}

export type SetUsernameResult =
  | { ok: true; username: string }
  | { ok: false; reason: string };

/**
 * Change an account's handle to one the user typed.
 *
 * Uniqueness is decided by the unique index, not by a SELECT beforehand: a
 * check-then-write would let two people who submit the same name at the same
 * moment both pass the check. The constraint violation is translated back into
 * the same message the pre-check would have produced, so the race is invisible
 * to whoever lost it.
 *
 * Unlike the social handles, clearing is not offered — a handle is how the
 * account is addressed in the chrome and in comment bylines, so there is
 * always one. Changing it to something else is the only move.
 */
export async function setUsername(
  userId: string,
  raw: string
): Promise<SetUsernameResult> {
  const checked = checkUsername(raw);
  if (!checked.ok) return { ok: false, reason: checked.reason };

  const current = await currentUsername(userId);
  if (current === checked.username) return { ok: true, username: current };

  try {
    const [row] = await db
      .update(users)
      .set({ username: checked.username })
      .where(eq(users.id, userId))
      .returning({ username: users.username });
    if (!row?.username) return { ok: false, reason: "Account not found." };
    return { ok: true, username: row.username };
  } catch (e) {
    if (isUsernameTaken(e)) {
      return { ok: false, reason: `@${checked.username} is already taken.` };
    }
    throw e;
  }
}
