/**
 * Username rules.
 *
 * Worth a test rather than an eyeball because three of them are load-bearing
 * and silent when wrong. Normalisation is what makes the plain UNIQUE
 * constraint case-insensitive — if "Octocat" ever reaches the column
 * unchanged, two accounts can hold the same handle in different clothes. The
 * reserved list is what stops a handle shadowing a route or passing as staff.
 * And the GitHub-login seed must agree with the validator, or sign-up hands
 * somebody a name the settings form would then refuse to let them keep.
 *
 * No database, no network, no key.
 */

import {
  checkUsername,
  DELETED_USERNAME_PREFIX,
  FALLBACK_USERNAME_PREFIX,
  generateUsername,
  isReservedUsername,
  normaliseUsername,
  RESERVED_USERNAMES,
  USERNAME_MAX,
  USERNAME_MIN,
  usernameFromGithubLogin,
} from "@/lib/username";

let pass = 0,
  fail = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) pass++;
  else fail++;
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}`);
};

// ── normalisation: the one form we store ────────────────────────────────────

ok("case is folded", normaliseUsername("Octocat") === "octocat");
ok("a leading @ is dropped", normaliseUsername("@octocat") === "octocat");
ok("repeated @ are dropped", normaliseUsername("@@octocat") === "octocat");
ok("surrounding space is trimmed", normaliseUsername("  octocat  ") === "octocat");
ok(
  "a pasted profile URL keeps the handle",
  normaliseUsername("https://github.com/Octocat") === "octocat"
);
ok(
  "a trailing slash does not eat the handle",
  normaliseUsername("https://github.com/octocat/") === "octocat"
);
// Idempotent, because the value is normalised both when checked and when
// compared against the column.
ok(
  "normalising twice changes nothing",
  normaliseUsername(normaliseUsername("@Octocat")) === "octocat"
);

// ── validation ──────────────────────────────────────────────────────────────

const reason = (raw: string) => {
  const r = checkUsername(raw);
  return r.ok ? null : r.reason;
};
const accepted = (raw: string) => {
  const r = checkUsername(raw);
  return r.ok ? r.username : null;
};

ok("a plain handle passes", accepted("octocat") === "octocat");
ok("hyphens pass", accepted("silent-otter") === "silent-otter");
ok("underscores pass", accepted("silent_otter") === "silent_otter");
ok("periods pass", accepted("silent.otter") === "silent.otter");
ok("digits pass", accepted("otter2026") === "otter2026");
ok("the checked value comes back normalised", accepted("@Silent-Otter") === "silent-otter");

ok("empty is refused", reason("") !== null);
ok("whitespace only is refused", reason("   ") !== null);
ok(`under ${USERNAME_MIN} characters is refused`, reason("ab") !== null);
ok(`exactly ${USERNAME_MIN} passes`, accepted("abc") === "abc");
ok(`exactly ${USERNAME_MAX} passes`, accepted("a".repeat(USERNAME_MAX)) !== null);
ok(`over ${USERNAME_MAX} is refused`, reason("a".repeat(USERNAME_MAX + 1)) !== null);

ok("spaces inside are refused", reason("silent otter") !== null);
ok("slashes are refused", reason("silent/otter") !== null);
ok("non-ASCII is refused", reason("sïlent") !== null);
// A leading or trailing separator is invisible at a glance, which is most of
// the way to a lookalike of somebody else's handle.
ok("a leading hyphen is refused", reason("-otter") !== null);
ok("a trailing hyphen is refused", reason("otter-") !== null);
ok("a leading period is refused", reason(".otter") !== null);
ok("a trailing underscore is refused", reason("otter_") !== null);
ok("doubled separators are refused", reason("silent--otter") !== null);
ok("mixed doubled separators are refused", reason("silent._otter") !== null);
// Every refusal must say what to fix: this is the only message the form shows.
ok(
  "each refusal carries a reason",
  ["", "ab", "silent otter", "-otter", "silent--otter", "admin"].every(
    (v) => (reason(v) ?? "").length > 0
  )
);

// ── the reserved list ───────────────────────────────────────────────────────

ok("a route segment is reserved", reason("admin") !== null);
ok("the API segment is reserved", reason("api") !== null);
ok("the site's own name is reserved", reason("repoherald") !== null);
ok("a staff-sounding handle is reserved", reason("moderator") !== null);
ok("case does not evade the reserved list", isReservedUsername("ADMIN"));
ok("an @ does not evade the reserved list", isReservedUsername("@admin"));
// Both prefixes are written by the system itself — account deletion and the
// last-resort fallback — so neither may be typed in by a user.
ok(
  "the deleted- prefix is reserved",
  isReservedUsername(`${DELETED_USERNAME_PREFIX}1a2b3c4d`)
);
ok(
  "the member- prefix is reserved",
  isReservedUsername(`${FALLBACK_USERNAME_PREFIX}0f8a1b2c3d4e`)
);
ok(
  "every reserved word is actually refused",
  [...RESERVED_USERNAMES].every((w) => !checkUsername(w).ok)
);
// The two generators must not produce something their own validator rejects
// for being reserved.
ok(
  "no reserved word is shorter than the minimum",
  [...RESERVED_USERNAMES].every((w) => w.length >= USERNAME_MIN || w === "u" || w === "me")
);

// ── seeding from a GitHub login ─────────────────────────────────────────────

ok("a GitHub login seeds the handle", usernameFromGithubLogin("Octocat") === "octocat");
ok(
  "a hyphenated login seeds the handle",
  usernameFromGithubLogin("the-octocat") === "the-octocat"
);
ok("a null login seeds nothing", usernameFromGithubLogin(null) === null);
ok("an empty login seeds nothing", usernameFromGithubLogin("") === null);
// GitHub allows one- and two-character logins and we do not; such an account
// gets a generated handle rather than an invalid one.
ok("a too-short login seeds nothing", usernameFromGithubLogin("ab") === null);
ok("a reserved login seeds nothing", usernameFromGithubLogin("support") === null);
ok(
  "a login at GitHub's own limit still seeds",
  usernameFromGithubLogin("a".repeat(39)) === "a".repeat(39)
);
// The seed is only ever used if it would survive the settings form too.
ok(
  "anything seeded also validates",
  ["Octocat", "the-octocat", "a".repeat(39), "x1"]
    .map(usernameFromGithubLogin)
    .filter((v): v is string => v !== null)
    .every((v) => checkUsername(v).ok)
);

// ── generation ──────────────────────────────────────────────────────────────

// Injected RNG, so the output is pinned rather than sampled — the same reason
// resolveRepo takes its lookup and completion as arguments.
const lowest = () => 0;
const highest = () => 0.999999;
// rand() === 1 would index one past the end of the word list if the generator
// did not clamp, which is exactly the kind of once-in-a-while crash a test
// should be the one to find.
const outOfRange = () => 1;

ok("the first attempt is a bare pair", /^[a-z]+-[a-z]+$/.test(generateUsername(lowest, 0)));
ok(
  "a later attempt adds four digits",
  /^[a-z]+-[a-z]+-\d{4}$/.test(generateUsername(lowest, 1))
);
ok("the lowest draw is in range", generateUsername(lowest, 0).length > 0);
ok("the highest draw is in range", generateUsername(highest, 0).split("-").length === 2);
ok(
  "rand() === 1 does not run off the word list",
  /^[a-z]+-[a-z]+$/.test(generateUsername(outOfRange, 0))
);
ok(
  "the digits are zero-padded to a fixed shape",
  generateUsername(lowest, 1).endsWith("-0000")
);
ok(
  "the digits never exceed four",
  generateUsername(outOfRange, 1).split("-")[2] === "9999"
);

// Whatever is generated has to pass the form's own rules, or sign-up would
// hand somebody a handle they could not re-save.
const sample = Array.from({ length: 400 }, (_, i) =>
  generateUsername(Math.random, i % 3)
);
ok("every generated handle validates", sample.every((v) => checkUsername(v).ok));
ok("no generated handle is reserved", sample.every((v) => !isReservedUsername(v)));
ok(
  "every generated handle fits the column rules",
  sample.every((v) => v.length >= USERNAME_MIN && v.length <= USERNAME_MAX)
);
ok("generation is lowercase", sample.every((v) => v === v.toLowerCase()));
// Not a uniqueness guarantee — the database decides that — but a generator
// with no spread would make the retry ladder pointless.
ok("generation has spread", new Set(sample).size > sample.length / 2);

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
