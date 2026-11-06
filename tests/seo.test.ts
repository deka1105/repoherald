/**
 * The SEO surface that is easy to get wrong silently.
 *
 * Three things are worth a test here rather than an eyeball. robots.ts decides
 * what a crawler is invited into, and a missing entry publishes something
 * private. The JSON-LD serialiser embeds GitHub-supplied strings into a script
 * element, so an unescaped `<` is an injection. And the schema builders make
 * factual claims to a search engine, so the rule that they never invent a
 * value needs enforcing.
 *
 * No database, no network, no key.
 */

import robots from "@/app/robots";
import { abs, APP_STORE_URL, NOINDEX, SITE_NAME, SITE_URL } from "@/lib/site";
import { rfc822, xmlText } from "@/lib/xml";
import {
  breadcrumbs,
  faqSchema,
  organizationSchema,
  repoSchema,
  serializeJsonLd,
  websiteSchema,
} from "@/lib/schema";

let pass = 0,
  fail = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) pass++;
  else fail++;
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}`);
};

// ── site helpers ────────────────────────────────────────────────────────────

ok("SITE_URL has no trailing slash", !SITE_URL.endsWith("/"));
ok("abs() joins a rooted path", abs("/repos/x") === `${SITE_URL}/repos/x`);
ok("abs() adds a missing slash", abs("repos/x") === `${SITE_URL}/repos/x`);
ok("abs() defaults to the origin", abs() === `${SITE_URL}/`);
ok("abs() never doubles the slash", !abs("/a").includes("//a"));
ok("NOINDEX blocks indexing", NOINDEX.index === false);
// follow:false as well — the links on a private page lead further inside it.
ok("NOINDEX blocks following", NOINDEX.follow === false);

// ── robots.txt: what a crawler is invited into ──────────────────────────────

const r = robots();
const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
const disallow = (rule?.disallow ?? []) as string[];

ok("the root is allowed", rule?.allow === "/");
ok("a sitemap is declared", typeof r.sitemap === "string" && r.sitemap.endsWith("/sitemap.xml"));
ok("the sitemap URL is absolute", String(r.sitemap).startsWith("https://"));

// Each of these is private, token-bearing, or index-polluting. A regression
// here is a privacy problem, not a ranking one.
for (const path of [
  "/admin",
  "/api/",
  "/account",
  "/wallet",
  "/credits",
  "/post",
  "/promote",
  "/lists",
  "/search",
  "/unsubscribe",
  "/email-preview",
]) {
  ok(`disallows ${path}`, disallow.includes(path));
}

// The pages that are supposed to rank must NOT be disallowed.
for (const path of ["/repos", "/identify", "/support", "/privacy"]) {
  ok(`does not disallow ${path}`, !disallow.includes(path));
}

// ── JSON-LD serialisation: GitHub strings land inside a <script> ────────────

const nasty = repoSchema({
  id: "r1",
  name: "</script><script>alert(1)</script>",
  fullName: "owner/<img src=x>",
  description: "a <b>bold</b> claim",
  primaryLanguage: "TypeScript",
});
const json = serializeJsonLd(nasty);

ok("no raw '<' survives serialisation", !json.includes("<"));
ok("'</script' cannot appear", !json.toLowerCase().includes("</script"));
ok("the escape is the unicode form", json.includes("\\u003c"));
ok(
  "it still parses back to the original string",
  (JSON.parse(json) as { description: string }).description === "a <b>bold</b> claim",
);

// ── schema builders: never assert what we do not know ──────────────────────

const repo = repoSchema({
  id: "abc",
  name: "widget",
  fullName: "acme/widget",
  description: "  spaced  ",
  primaryLanguage: "Rust",
});
ok("repo is SoftwareSourceCode", repo["@type"] === "SoftwareSourceCode");
ok("repo url is canonical", repo.url === abs("/repos/abc"));
ok("repo points at GitHub", repo.codeRepository === "https://github.com/acme/widget");
ok("description is trimmed", repo.description === "spaced");
ok("language is carried", repo.programmingLanguage === "Rust");
// The repos table does not record whether a GitHub owner is a user or an org,
// so naming either would be a guess stated as fact.
ok("no author is invented", !("author" in repo));
// Stars are not ratings; presenting them as one invites a manual action.
ok("no aggregateRating is invented", !("aggregateRating" in repo));

const bare = repoSchema({
  id: "abc",
  name: "widget",
  fullName: "acme/widget",
  description: null,
  primaryLanguage: null,
});
ok("a null description is omitted, not null", !("description" in bare));
ok("a null language is omitted, not null", !("programmingLanguage" in bare));

const blank = repoSchema({
  id: "abc",
  name: "widget",
  fullName: "acme/widget",
  description: "   ",
  primaryLanguage: null,
});
ok("a whitespace description is omitted", !("description" in blank));

// legalName follows the same rule as the policy pages: only when configured.
const orgUnset = organizationSchema({ entityName: null });
ok("org always carries the brand name", orgUnset.name === SITE_NAME);
ok("no legalName is invented", !("legalName" in orgUnset));
ok("no logo when none is given", !("logo" in orgUnset));

const orgSet = organizationSchema({
  entityName: "Example Labs Ltd",
  logoPath: "/brand/shield-black.png",
});
ok("a configured legalName is used", orgSet.legalName === "Example Labs Ltd");
ok("the logo is absolute", orgSet.logo === abs("/brand/shield-black.png"));

// `sameAs` is the property an audit nags for, so the rule that it is never
// padded out with a plausible-looking URL needs enforcing rather than
// trusting. An absent, empty or blank-only list must omit it entirely.
ok("no sameAs when none is given", !("sameAs" in orgUnset));
ok(
  "an empty sameAs list is omitted, not emitted empty",
  !("sameAs" in organizationSchema({ entityName: null, sameAs: [] })),
);
ok(
  "a whitespace-only sameAs is omitted",
  !("sameAs" in organizationSchema({ entityName: null, sameAs: ["  "] })),
);
const orgProfiles = organizationSchema({
  entityName: null,
  sameAs: [" https://example.com/a ", "", "https://example.com/b"],
});
ok(
  "real sameAs entries are kept, trimmed, and blanks dropped",
  JSON.stringify(orgProfiles.sameAs) ===
    JSON.stringify(["https://example.com/a", "https://example.com/b"]),
);

// The App Store id comes from mobile/eas.json; this guards the public form
// of it, since a malformed URL here is a schema claim pointing nowhere.
ok(
  "the App Store URL is an absolute apps.apple.com app link",
  /^https:\/\/apps\.apple\.com\/app\/id\d+$/.test(APP_STORE_URL),
);

const site = websiteSchema("desc");
ok("website is WebSite", site["@type"] === "WebSite");
// Google retired the sitelinks searchbox, so this would be inert markup.
ok("no SearchAction is emitted", !("potentialAction" in site));

const crumbs = breadcrumbs([
  { name: "repoherald", path: "/" },
  { name: "acme/widget", path: "/repos/abc" },
]);
const items = crumbs.itemListElement as { position: number; item: string }[];
ok("breadcrumbs are BreadcrumbList", crumbs["@type"] === "BreadcrumbList");
ok("positions are 1-based", items[0].position === 1 && items[1].position === 2);
ok("breadcrumb items are absolute", items[1].item === abs("/repos/abc"));

// --- dates: real column values, or nothing -------------------------------
// A dateModified that moves whenever the page is rendered is worse than none:
// it trains a consumer to ignore the field. So an absent date must stay absent.
ok("website omits dateModified when none is given", !("dateModified" in site));
const dated = websiteSchema("desc", new Date("2026-03-04T05:06:07.000Z"));
ok(
  "website dateModified is ISO 8601",
  dated.dateModified === "2026-03-04T05:06:07.000Z",
);
ok(
  "a null date is not emitted",
  !("dateModified" in websiteSchema("desc", null)),
);

const bareRepo = repoSchema({
  id: "abc",
  name: "widget",
  fullName: "acme/widget",
  description: null,
  primaryLanguage: null,
});
ok("no datePublished without createdAt", !("datePublished" in bareRepo));
ok("no dateModified without either date", !("dateModified" in bareRepo));

const posted = new Date("2026-01-02T00:00:00.000Z");
const synced = new Date("2026-02-03T00:00:00.000Z");
const bothDates = repoSchema({
  id: "abc",
  name: "widget",
  fullName: "acme/widget",
  description: null,
  primaryLanguage: null,
  createdAt: posted,
  lastSyncedAt: synced,
});
ok(
  "datePublished is when it was posted here",
  bothDates.datePublished === posted.toISOString(),
);
ok(
  "dateModified prefers lastSyncedAt",
  bothDates.dateModified === synced.toISOString(),
);

const neverSynced = repoSchema({
  id: "abc",
  name: "widget",
  fullName: "acme/widget",
  description: null,
  primaryLanguage: null,
  createdAt: posted,
  lastSyncedAt: null,
});
// dateModified must never precede datePublished, which the fallback guarantees.
ok(
  "dateModified falls back to createdAt",
  neverSynced.dateModified === posted.toISOString(),
);

// --- FAQPage --------------------------------------------------------------
const faq = faqSchema([
  { q: "How do I earn credits?", a: "Star any listed repo." },
  { q: "Why negative?", a: "A revoked star is clawed back." },
]);
const questions = faq.mainEntity as {
  "@type": string;
  name: string;
  acceptedAnswer: { "@type": string; text: string };
}[];
ok("faq is FAQPage", faq["@type"] === "FAQPage");
ok("every entry is a Question", questions.every((q) => q["@type"] === "Question"));
ok(
  "answers are Answer objects",
  questions.every((q) => q.acceptedAnswer["@type"] === "Answer"),
);
ok("the question text is carried verbatim", questions[0].name === "How do I earn credits?");
ok(
  "the answer text is carried verbatim",
  questions[1].acceptedAnswer.text === "A revoked star is clawed back.",
);

// --- feed XML escaping ----------------------------------------------------
// Same hazard as serializeJsonLd, different output format: these strings come
// from GitHub, and one stray character makes the whole feed unparseable.
ok("ampersands escape first, once", xmlText("a & b") === "a &amp; b");
ok(
  "an existing entity is not double-escaped into nonsense",
  xmlText("&amp;") === "&amp;amp;",
);
ok("angle brackets escape", xmlText("<item>") === "&lt;item&gt;");
ok("quotes escape for attribute use", xmlText('say "hi"') === "say &quot;hi&quot;");
ok(
  "a closing tag cannot be injected",
  !xmlText("</description><script>x</script>").includes("<"),
);
// XML 1.0 has no representation for these at all, so they must be removed
// rather than escaped — a single one invalidates the document.
ok("C0 controls are stripped", xmlText("a\u0000b\u0007c") === "abc");
ok(
  "legal whitespace survives",
  xmlText("a\tb\nc\rd") === "a\tb\nc\rd",
);
ok(
  "pubDate is RFC 822",
  rfc822(new Date("2026-03-04T05:06:07.000Z")) === "Wed, 04 Mar 2026 05:06:07 GMT",
);

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
