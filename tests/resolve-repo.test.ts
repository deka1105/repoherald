/**
 * The identification ladder, proved without a key and without a token.
 *
 * What matters here is not whether Nemotron is clever — the eval in
 * `npm run eval:resolve` measures that against the real endpoint. What matters
 * here is that the ladder cannot be talked into a wrong answer: GitHub is the
 * only thing that decides a repository exists, and a confident model naming a
 * repo that 404s must produce no result at all.
 */

import type { GithubRepo } from "@/lib/github";
import { resolveRepo, urlsIn, type Completer } from "@/lib/resolve-repo";
import { buildCases, buildDescribedCases } from "./corrupt";
import names from "./fixtures/repo-names.json";
import descriptions from "./fixtures/repo-descriptions.json";

let pass = 0,
  fail = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) pass++;
  else fail++;
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}`);
};

const REAL = new Set(names.map((n) => n.toLowerCase()));

/** Stands in for the GitHub API: the fixture names exist, nothing else does. */
const lookup = async (owner: string, repo: string): Promise<GithubRepo | null> => {
  const full = `${owner}/${repo}`;
  if (!REAL.has(full.toLowerCase())) return null;
  return {
    id: 1,
    full_name: full,
    name: repo,
    description: null,
    language: "TypeScript",
    stargazers_count: 10,
    archived: false,
    private: false,
    owner: { login: owner, avatar_url: "", type: "User" },
  };
};

/** A model that answers with whatever the test tells it to, recording prompts. */
function stub(replies: string[]): Completer & { prompts: string[] } {
  const prompts: string[] = [];
  const fn = (async (opts) => {
    prompts.push(opts.user);
    return {
      text: replies[prompts.length - 1] ?? '{"candidates":[]}',
      model: "stub",
      promptTokens: 10,
      completionTokens: 5,
    };
  }) as Completer as Completer & { prompts: string[] };
  fn.prompts = prompts;
  return fn;
}

const target = names[0];
const [tOwner] = target.split("/");

// ── url extraction

ok("finds a bare github.com url", urlsIn(`see github.com/${target} now`)[0] === target);
ok("finds an https url", urlsIn(`https://github.com/${target}`)[0] === target);
ok("strips a .git suffix", urlsIn(`https://github.com/${target}.git`)[0] === target);
ok(
  "strips a deep link down to owner/repo",
  urlsIn(`https://github.com/${target}/blob/main/README.md`)[0] === target,
);
ok("strips trailing punctuation", urlsIn(`(github.com/${target}).`)[0] === target);
ok("finds nothing in text with no repo", urlsIn("just a reel about cooking").length === 0);
ok("ignores a non-github url", urlsIn("https://gitlab.com/foo/bar").length === 0);

// ── the ladder
// Wrapped in a function because the package is CJS and esbuild refuses
// top-level await there; `"type": "module"` would change how Next builds.

async function main() {
{
  const model = stub([]);
  const r = await resolveRepo(
    { caption: `free tool https://github.com/${target}` },
    lookup,
    { complete: model },
  );
  ok("a literal url resolves", r.repo?.full_name === target);
  ok("a literal url costs no model call", r.modelCalls === 0 && model.prompts.length === 0);
  ok("a literal url is the only full-confidence path", r.confidence === 1);
}

{
  const model = stub([
    JSON.stringify({
      candidates: [{ full_name: target, source: "narration", confidence: 0.8 }],
      reasoning: "spoken punctuation reconstructed",
    }),
  ]);
  const r = await resolveRepo({ transcript: "some mangled thing" }, lookup, {
    complete: model,
  });
  ok("the fast tier can resolve", r.repo?.full_name === target);
  ok("one model call when the fast tier succeeds", r.modelCalls === 1);
  ok("model confidence is capped below a url's", r.confidence <= 0.9);
  ok("the source is carried through", r.foundIn === "narration");
}

{
  // Fast tier guesses wrong; deep tier must be told so, and repairs.
  const model = stub([
    JSON.stringify({
      candidates: [{ full_name: `${tOwner}/definitely-not-real`, source: "narration", confidence: 0.9 }],
    }),
    JSON.stringify({
      candidates: [{ full_name: target, source: "narration", confidence: 0.7 }],
    }),
  ]);
  const r = await resolveRepo({ transcript: "mangled" }, lookup, { complete: model });
  ok("the deep tier recovers after a rejected candidate", r.repo?.full_name === target);
  ok("two model calls when the fast tier misses", r.modelCalls === 2);
  ok(
    "the deep tier is told which candidate GitHub rejected",
    model.prompts[1].includes(`${tOwner}/definitely-not-real`),
  );
  ok(
    "the rejected candidate is recorded as unresolved",
    r.attempts.some((a) => a.fullName === `${tOwner}/definitely-not-real` && !a.resolved),
  );
}

{
  // The load-bearing rule.
  const invented = JSON.stringify({
    candidates: [
      { full_name: "totally/invented-repo", source: "caption", confidence: 1 },
      { full_name: "another/fabrication", source: "caption", confidence: 0.99 },
    ],
  });
  const r = await resolveRepo({ caption: "something" }, lookup, {
    complete: stub([invented, invented]),
  });
  ok("a repo GitHub rejects is never returned", r.repo === null);
  ok("a rejected resolution carries no confidence", r.confidence === 0);
  ok("every invented candidate is recorded as tried", r.attempts.length >= 2);
  ok("no invented candidate is marked resolved", r.attempts.every((a) => !a.resolved));
}

{
  const r = await resolveRepo({}, lookup, { complete: stub([]) });
  ok("empty input resolves to nothing", r.repo === null && r.modelCalls === 0);
  ok("empty input says why", /no caption/i.test(r.reasoning));
}

{
  // A GitHub outage must not read as "this repo does not exist".
  const throwing = async () => {
    throw new Error("GitHub down");
  };
  const r = await resolveRepo(
    { caption: `https://github.com/${target}` },
    throwing,
    { complete: stub([]) },
  );
  ok("a lookup failure is not a rejection", r.repo === null && r.attempts[0].resolved === false);
}

{
  const model = stub(['{"candidates":[]}', '{"candidates":[]}']);
  const r = await resolveRepo({ caption: "a reel about nothing" }, lookup, {
    complete: model,
    search: async () => [`https://github.com/${target}`],
  });
  ok("web search is the last rung", r.repo?.full_name === target);
  ok("a web-search hit is recorded as such", r.attempts.some((a) => a.via === "web-search"));
  ok("web search confidence stays modest", r.confidence < 0.9);
}

// ── the search rung

{
  // The query must come from the model when it offered one, because the raw
  // post text is a terrible search query.
  const queries: string[] = [];
  const model = stub([
    JSON.stringify({ candidates: [], search_query: "open source photo editor written in rust" }),
    JSON.stringify({ candidates: [] }),
    JSON.stringify({ candidates: [{ full_name: target, confidence: 0.8 }] }),
  ]);
  const r = await resolveRepo({ caption: "stop paying for this 🔥 #devtools link in bio" }, lookup, {
    complete: model,
    search: async (q) => {
      queries.push(q);
      return [`GitHub - ${target}: a thing`, "GitHub - someone/unrelated: other"];
    },
  });
  ok("search uses the model's query, not the raw post", queries[0] === "open source photo editor written in rust");
  ok("the ranked result resolves", r.repo?.full_name === target);
  ok("a ranked hit scores above an unranked one", r.confidence === 0.65);
  ok("ranking costs a third model call", r.modelCalls === 3);
}

{
  // With no search_query offered, the fallback must strip social furniture.
  const queries: string[] = [];
  const model = stub(['{"candidates":[]}', '{"candidates":[]}', '{"candidates":[]}']);
  await resolveRepo(
    { caption: "stop paying for this 🔥 save this #devtools #opensource https://example.com link in bio" },
    lookup,
    { complete: model, search: async (q) => { queries.push(q); return []; } },
  );
  const q = queries[0] ?? "";
  ok("fallback query drops hashtags", !q.includes("#"));
  ok("fallback query drops urls", !q.includes("example.com"));
  ok("fallback query drops calls to action", !/link in bio|save this/i.test(q));
  ok("fallback query keeps something to search for", q.trim().length > 0);
}

{
  // If ranking throws, the rung still works off the raw links.
  let calls = 0;
  const flaky: Completer = async (opts) => {
    calls++;
    if (opts.system.startsWith("You are given a social media post")) throw new Error("ranking down");
    return { text: '{"candidates":[]}', model: "stub", promptTokens: 1, completionTokens: 1 };
  };
  const r = await resolveRepo({ caption: "a described thing" }, lookup, {
    complete: flaky,
    search: async () => [`https://github.com/${target}`],
  });
  ok("a ranking failure falls back to link extraction", r.repo?.full_name === target);
  ok("an unranked hit scores lower", r.confidence === 0.5);
  ok("the ranking call was attempted", calls === 3);
}

// ── the corpus

{
  const described = buildDescribedCases(descriptions);
  ok("the described corpus is non-trivial", described.length >= 40);
  ok(
    "no described case leaks the repo name it is testing for",
    described.every((c) => {
      const haystack = `${c.caption ?? ""} ${c.transcript ?? ""} ${c.stillsText ?? ""}`.toLowerCase();
      const [owner, name] = c.fullName.toLowerCase().split("/");
      return !haystack.includes(c.fullName.toLowerCase()) && !haystack.includes(name) && !haystack.includes(owner);
    }),
  );
  ok(
    "no described case contains a github link",
    described.every((c) => urlsIn(`${c.caption ?? ""} ${c.transcript ?? ""}`).length === 0),
  );
  ok(
    "the described corpus is deterministic",
    JSON.stringify(buildDescribedCases(descriptions)) ===
      JSON.stringify(buildDescribedCases(descriptions)),
  );
}

{
  const cases = buildCases(names);
  ok("every name yields four cases", cases.length === names.length * 4);
  ok(
    "the url mode always embeds a resolvable link",
    cases
      .filter((c) => c.mode === "caption_url")
      .every((c) => urlsIn(c.caption).includes(c.fullName)),
  );
  ok(
    "the narration mode never leaves a slash in the name",
    cases
      .filter((c) => c.mode === "narration")
      .every((c) => !c.transcript!.includes("/")),
  );
  ok(
    "the narration mode speaks the slash aloud",
    cases
      .filter((c) => c.mode === "narration")
      .every((c) => c.transcript!.includes(" slash ")),
  );
  ok(
    "the corpus is deterministic",
    JSON.stringify(buildCases(names)) === JSON.stringify(buildCases(names)),
  );
}

}

main().then(() => {
  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
