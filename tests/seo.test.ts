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
import { abs, NOINDEX, SITE_NAME, SITE_URL } from "@/lib/site";
import {
  breadcrumbs,
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

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
