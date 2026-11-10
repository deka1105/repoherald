/**
 * Username rules: the public handle every account carries.
 *
 * Pure on purpose — no database, no `server-only` — so the generator and the
 * validator are unit-testable without a connection, the same reason
 * src/lib/xml.ts and src/lib/schema.ts are separate modules. The DB side lives
 * in src/lib/username-claim.ts.
 *
 * Stored LOWERCASE with no leading "@", which is what makes the plain UNIQUE
 * constraint on the column a case-insensitive one: "Octocat" and "octocat"
 * normalise to the same string before they ever reach Postgres, so there is no
 * second way to spell a taken name. Same trick as the social handles in
 * src/lib/platform-lists.ts, and the reason neither needs citext.
 */

/** Three, because one- and two-character handles are ambiguous and squatted. */
export const USERNAME_MIN = 3;

/**
 * 39 to match GitHub's own limit, not an arbitrary round number: a new account
 * is seeded from its GitHub login where there is one, and a ceiling below
 * GitHub's would silently reject a perfectly real login and hand that person a
 * generated name instead.
 */
export const USERNAME_MAX = 39;

/**
 * Written onto a purged account's handle by src/lib/account-deletion.ts, which
 * anonymises rather than deletes. Reserved as a PREFIX below so nobody can
 * claim a name that reads as somebody else's deleted account.
 */
export const DELETED_USERNAME_PREFIX = "deleted-";

/** Same idea: the last-resort handle in username-claim.ts is `member-<id>`. */
export const FALLBACK_USERNAME_PREFIX = "member-";

/**
 * Names nobody may claim.
 *
 * Two kinds, for two different reasons. The route segments are here so that a
 * future `/u/<username>` or `/@<username>` cannot be shadowed by a handle —
 * cheap now, impossible to retrofit once somebody owns "admin". The rest are
 * words that would let a handle pass as staff or as the site itself, which is
 * impersonation however politely it is spelled.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // Route segments that exist today.
  "about", "account", "admin", "api", "cookies", "credits", "feed", "identify",
  "lists", "manifest", "post", "privacy", "promote", "refunds", "repos",
  "robots", "search", "sitemap", "support", "terms", "unsubscribe", "wallet",
  // Segments a site like this one grows into.
  "assets", "auth", "blog", "contact", "dashboard", "docs", "help", "home",
  "legal", "login", "logout", "me", "mcp", "new", "notifications", "pricing",
  "profile", "public", "settings", "signin", "signout", "signup", "sponsor",
  "static", "status", "u", "user", "users",
  // Words that would read as the site or its staff.
  "anonymous", "deleted", "everyone", "help-desk", "member", "moderator",
  "mod", "official", "owner", "repoherald", "root", "security", "staff",
  "system", "team", "null", "undefined",
]);

/** Adjective-noun pairs read as a name; a hashed id reads as a database key. */
const ADJECTIVES = [
  "amber", "brisk", "bright", "calm", "clever", "copper", "crisp", "dawn",
  "deep", "eager", "early", "fleet", "fond", "gentle", "glad", "golden",
  "grand", "green", "happy", "hidden", "humble", "keen", "kind", "lively",
  "loyal", "lucky", "mellow", "merry", "mild", "misty", "neat", "noble",
  "northern", "open", "patient", "placid", "plain", "prime", "proud", "quiet",
  "rapid", "ready", "royal", "sharp", "silent", "silver", "simple", "sleek",
  "snowy", "solar", "spry", "steady", "still", "sunny", "swift", "tidy",
  "trusty", "vivid", "warm", "wise",
] as const;

const NOUNS = [
  "anchor", "arbor", "atlas", "badger", "beacon", "bellows", "bridge", "cabin",
  "canyon", "cedar", "cipher", "comet", "compass", "delta", "ember", "falcon",
  "ferry", "forge", "garden", "glacier", "granite", "harbor", "harvest",
  "heron", "hollow", "island", "jetty", "kernel", "lantern", "ledger",
  "lupine", "maple", "meadow", "meridian", "orchard", "otter", "paddle",
  "pebble", "pine", "prairie", "quarry", "quill", "ridge", "river", "sable",
  "sandbar", "sequoia", "sextant", "signal", "sparrow", "summit", "thicket",
  "tide", "timber", "trestle", "valley", "willow",
] as const;

export type UsernameCheck =
  | { ok: true; username: string }
  | { ok: false; reason: string };

/**
 * Lowercase, strip a leading "@" and any pasted profile URL prefix.
 *
 * Does NOT validate — it only puts the input into the one form we store, so
 * that `checkUsername` and the uniqueness lookup agree about what was typed.
 */
export function normaliseUsername(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      // Trailing slash first, so a pasted "github.com/octocat/" still ends in
      // the handle by the time the host is stripped.
      .replace(/\/+$/, "")
      // A pasted profile URL keeps its last path segment. Anchored on a
      // host-looking prefix rather than "anything up to a slash": a bare
      // "silent/otter" is a typo, and quietly turning it into "otter" would
      // save a handle nobody asked for. Without the host it stays invalid and
      // the form says so.
      .replace(/^(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}\/+/, "")
      .replace(/^@+/, "")
      .trim()
  );
}

/**
 * Validate a handle somebody typed, with a reason when it fails.
 *
 * The reason is returned rather than a bare boolean because this is the one
 * message the user sees when a form rejects them, and "invalid username" does
 * not tell anyone what to fix. Uniqueness is NOT checked here — that needs the
 * database and belongs to the caller.
 */
export function checkUsername(raw: string): UsernameCheck {
  const username = normaliseUsername(raw);

  if (!username) return { ok: false, reason: "Pick a username." };
  if (username.length < USERNAME_MIN) {
    return { ok: false, reason: `At least ${USERNAME_MIN} characters.` };
  }
  if (username.length > USERNAME_MAX) {
    return { ok: false, reason: `At most ${USERNAME_MAX} characters.` };
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return {
      ok: false,
      reason: "Letters, numbers, hyphens, underscores and periods only.",
    };
  }
  // Separators in the middle only: a leading or trailing one is invisible at a
  // glance, which is most of the way to a lookalike handle.
  if (!/^[a-z0-9]/.test(username) || !/[a-z0-9]$/.test(username)) {
    return { ok: false, reason: "Start and end with a letter or number." };
  }
  if (/[._-]{2,}/.test(username)) {
    return { ok: false, reason: "No two separators in a row." };
  }
  if (isReservedUsername(username)) {
    return { ok: false, reason: "That username is reserved." };
  }

  return { ok: true, username };
}

/** Reserved outright, or wearing a prefix the system writes itself. */
export function isReservedUsername(username: string): boolean {
  const v = normaliseUsername(username);
  return (
    RESERVED_USERNAMES.has(v) ||
    v.startsWith(DELETED_USERNAME_PREFIX) ||
    v.startsWith(FALLBACK_USERNAME_PREFIX)
  );
}

/**
 * A handle to seed a new account with, from its GitHub login.
 *
 * Preferred over a generated name when it survives the rules, because it is
 * already what the header, the feed and every comment byline call this person
 * — assigning them a random pair instead would rename them on sign-up. Returns
 * null for a login that cannot be a username here (too short, reserved, or
 * carrying characters GitHub allows and we do not), and the caller generates.
 */
export function usernameFromGithubLogin(login: string | null | undefined): string | null {
  if (!login) return null;
  const checked = checkUsername(login);
  return checked.ok ? checked.username : null;
}

/**
 * A random but pronounceable handle: `silent-otter`, or `silent-otter-4821`.
 *
 * `rand` is injected so a test can pin the output — the same reason
 * `resolveRepo` takes its lookup and completion functions. `attempt` escalates
 * on collision: the bare pair is nicer, so it is tried first, and the digits
 * are added only once the caller has learned that the pair is taken.
 */
export function generateUsername(rand: () => number = Math.random, attempt = 0): string {
  const pick = <T,>(list: readonly T[]): T =>
    list[Math.min(list.length - 1, Math.floor(rand() * list.length))];

  const pair = `${pick(ADJECTIVES)}-${pick(NOUNS)}`;
  if (attempt < 1) return pair;

  // Four digits, zero-padded so every generated handle is the same shape.
  const n = Math.min(9999, Math.floor(rand() * 10000));
  return `${pair}-${String(n).padStart(4, "0")}`;
}
