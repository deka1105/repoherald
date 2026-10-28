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
import { isGrounded, resolveRepo, urlsIn, type Completer } from "@/lib/resolve-repo";
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
    // Rung 5 asks a different question. Answering it here keeps the queued
    // replies aligned with the extraction calls the tests are actually about;
    // the rung has its own dedicated tests further down.
    if (opts.system.startsWith("You are checking whether")) {
      return { text: '{"match":true}', model: "stub", promptTokens: 1, completionTokens: 1, truncated: false };
    }
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

/**
 * The target as a transcript would carry it: punctuation pronounced, hyphens
 * dropped. The model rungs only ever claim to repair a name that is present in
 * the text, so a fixture whose text does not contain the name is testing a
 * situation the ladder is not supposed to answer — see `isGrounded`.
 */
const spoken = (full: string) =>
  `okay so number one on my list is ${full
    .replace("/", " slash ")
    .replace(/[-_]/g, " ")
    .toLowerCase()} and it deserves more stars`;

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
  const r = await resolveRepo({ transcript: spoken(target) }, lookup, {
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
  const r = await resolveRepo({ transcript: spoken(target) }, lookup, { complete: model });
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

// ── the model being unreachable (an exhausted balance, a revoked key, an outage)

{
  const dead: Completer = async () => {
    throw new Error("Nebius Token Factory returned 402: balance exhausted");
  };
  const r = await resolveRepo(
    { caption: `the tool is at https://github.com/${target}` },
    lookup,
    { complete: dead },
  );
  ok("a literal link still resolves with the model dead", r.repo?.full_name === target);
  ok("rung 1 never touches the model, so nothing is flagged", r.modelUnavailable === undefined);
}

{
  const dead: Completer = async () => {
    throw new Error("Nebius Token Factory returned 402: balance exhausted");
  };
  const r = await resolveRepo({ transcript: "ertasselli slash openterminal" }, lookup, {
    complete: dead,
  });
  ok("an unreachable model does not throw out of the ladder", r.repo === null);
  ok("it reports why it degraded", /balance exhausted/.test(r.modelUnavailable ?? ""));
  ok("it says plainly that the repair rungs did not run", /could not be reached/i.test(r.reasoning));
  ok("a failed call is not counted as a call", r.modelCalls === 0);
}

{
  // The deep tier shares the balance, so one failure stops the asking.
  let calls = 0;
  const diesOnSecond: Completer = async () => {
    calls++;
    if (calls === 1) return { text: '{"candidates":[{"full_name":"no/such-repo","source":"caption","confidence":0.9}]}', model: "stub", truncated: false };
    throw new Error("402 balance exhausted");
  };
  const r = await resolveRepo({ transcript: "mangled" }, lookup, { complete: diesOnSecond });
  ok("a mid-ladder failure stops further model calls", calls === 2);
  ok("the partial work is still reported", r.attempts.some((a) => a.fullName === "no/such-repo"));
  ok("and it is still flagged as degraded", Boolean(r.modelUnavailable));
}

{
  // Search can still run with the model down: its query has a model-free
  // fallback and its ranking already degrades to reading links.
  const dead: Completer = async () => {
    throw new Error("402 balance exhausted");
  };
  const r = await resolveRepo(
    { transcript: "a self hosted parametric cad application written in pure rust" },
    lookup,
    { complete: dead, search: async () => [`https://github.com/${target}`] },
  );
  ok("the search rung survives the model being down", r.repo?.full_name === target);
  ok("the degradation is still reported alongside the hit", Boolean(r.modelUnavailable));
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
  // fast, deep, rank, then rung 5's verdict
  ok("ranking and verification cost two calls beyond the tiers", r.modelCalls === 4);
}

{
  // With no search_query offered, the fallback must strip social furniture.
  const queries: string[] = [];
  const model = stub(['{"candidates":[]}', '{"candidates":[]}', '{"candidates":[]}']);
  await resolveRepo(
    {
      caption:
        "stop paying for this 🔥 save this #devtools #opensource https://example.com link in bio",
      transcript: "a self hosted parametric CAD application written in pure rust",
    },
    lookup,
    { complete: model, search: async (q) => { queries.push(q); return []; } },
  );
  const q = queries[0] ?? "";
  ok("fallback query drops hashtags", !q.includes("#"));
  ok("fallback query drops urls", !q.includes("example.com"));
  ok("fallback query drops calls to action", !/link in bio|save this/i.test(q));
  ok("fallback query keeps the descriptive part", /parametric cad/i.test(q));
}

{
  // Furniture only: nothing left to search for, so nothing should be searched.
  let searched = false;
  await resolveRepo(
    { caption: "save this 🔥 #devtools link in bio" },
    lookup,
    {
      complete: stub(['{"candidates":[]}', '{"candidates":[]}']),
      search: async () => {
        searched = true;
        return [];
      },
    },
  );
  ok("an empty query never reaches Tavily", searched === false);
}

{
  // If ranking throws, the rung still works off the raw links.
  let calls = 0;
  const flaky: Completer = async (opts) => {
    calls++;
    if (opts.system.startsWith("You are checking whether"))
      return { text: '{"match":true}', model: "stub", promptTokens: 1, completionTokens: 1, truncated: false };
    if (opts.system.startsWith("You are given a social media post")) throw new Error("ranking down");
    return { text: '{"candidates":[]}', model: "stub", promptTokens: 1, completionTokens: 1, truncated: false };
  };
  const r = await resolveRepo({ caption: "a described thing" }, lookup, {
    complete: flaky,
    search: async () => [`https://github.com/${target}`],
  });
  ok("a ranking failure falls back to link extraction", r.repo?.full_name === target);
  ok("an unranked hit scores lower", r.confidence === 0.5);
  // fast, deep, the ranking that threw, then rung 5 on the extracted link
  ok("the ranking call was attempted", calls === 4);
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

// ── grounding: the model may repair a name, not invent one
//
// The eval found this the expensive way: on 41 descriptions with the name
// scrubbed out, the model returned a real-but-wrong repository 14.6% of the
// time, and GitHub validation cannot catch that because the repository exists.

{
  ok(
    "a mangled OCR name is grounded by its surviving half",
    isGrounded("HKUDS/ViMax", "FREE ALTERNATIVE\nHKUD5/ViMax\ngithub\nSAVE THIS"),
  );
  ok(
    "spoken punctuation does not break grounding",
    isGrounded("yt-dlp/yt-dlp", "number one is yt dlp slash yt dlp, link in bio"),
  );
  ok(
    "case and separators are ignored",
    isGrounded("ErTasselli/OpenTerminal", "it is ertasselli slash openterminal honestly"),
  );
  ok(
    "a name that appears nowhere is refused",
    !isGrounded(
      "binwiederhier/ntfy",
      "the open source tool that sends push notifications from a shell script",
    ),
  );
  ok(
    "the real described_only failures are all refused",
    [
      ["jepsen-io/jepsen", "a library for testing distributed systems for consistency"],
      ["apify/crawlee", "a fast crawler and scraper for discovery and reconnaissance"],
      ["TabbyML/tabby", "a self hosted coding assistant you can run on your own gpu"],
      ["CadQuery/CQ-editor", "parametric modelling of physical parts from a script"],
    ].every(([full, post]) => !isGrounded(full, post)),
  );
  ok(
    "a token shorter than the floor cannot ground a candidate",
    !isGrounded("shadcn-ui/ui", "a guide to building an intuitive user interface"),
  );
  ok("empty text grounds nothing", !isGrounded("owner/repo", ""));

  // And the behaviour through the whole ladder: a plausible, real, existing
  // repository that the post never mentions must not come back.
  const fabricates: Completer = async () => ({
    text: '{"candidates":[{"full_name":"jepsen-io/jepsen","source":"caption","confidence":1.0,"why":"it is obviously this"}],"reasoning":"confident"}',
    model: "stub",
    truncated: false,
  });
  // A lookup that says yes to everything, which is the real situation: the
  // fabricated repository genuinely exists.
  const everythingExists = async (owner: string, name: string): Promise<GithubRepo> => ({
    id: 1,
    name,
    full_name: `${owner}/${name}`,
    private: false,
    description: null,
    language: null,
    stargazers_count: 0,
    archived: false,
    owner: { login: owner, avatar_url: "", type: "User" },
  });

  const r = await resolveRepo(
    { caption: "a library for testing distributed systems for consistency" },
    everythingExists,
    { complete: fabricates, search: async () => [] },
  );
  ok("an ungrounded candidate is not returned even though GitHub confirms it", r.repo === null);
  ok(
    "the ungrounded candidate is still reported, flagged",
    r.attempts.some((a) => a.fullName === "jepsen-io/jepsen" && a.ungrounded === true),
  );
  ok(
    "and GitHub was never asked about it",
    r.attempts.filter((a) => a.fullName === "jepsen-io/jepsen" && !a.ungrounded).length === 0,
  );

  // ── rung 4 is for posts that name nothing, not for posts we failed to read
  //
  // Measured with this gate missing, `screen` hit 10.5% wrong: search always
  // returns something and the ranking always picks one, so a half-read name
  // becomes a confident wrong answer.
  {
    let searched = 0;
    // A mangled name is present; the model proposes it; GitHub says no.
    const proposesMissing: Completer = async () => ({
      text: '{"candidates":[{"full_name":"HKUDS/ViMaxx","source":"screen","confidence":0.8}],"search_query":"a tool for making short clips from long video"}',
      model: "stub",
      truncated: false,
    });
    const r3 = await resolveRepo({ stillsText: "HKUD5/ViMaxx" }, async () => null, {
      complete: proposesMissing,
      search: async () => {
        searched++;
        return ["GitHub - someone/unrelated https://github.com/someone/unrelated a clip tool"];
      },
    });
    ok("a post that names something never reaches the search rung", searched === 0);
    ok("and it answers 'I don't know' rather than a near-miss", r3.repo === null);

    // Nothing named anywhere: this is what the rung exists for.
    let searched2 = 0;
    const namesNothing: Completer = async (opts) =>
      opts.system.startsWith("You are checking whether")
        ? { text: '{"match":true}', model: "stub", truncated: false }
        : {
            text: '{"candidates":[],"search_query":"self hosted push notifications from a shell script"}',
            model: "stub",
            truncated: false,
          };
    const r4 = await resolveRepo(
      { caption: "the open source thing that pushes alerts to your phone from a shell script" },
      everythingExists,
      {
        complete: namesNothing,
        search: async () => {
          searched2++;
          return ["GitHub - binwiederhier/ntfy https://github.com/binwiederhier/ntfy push notifications"];
        },
      },
    );
    ok("a post that names nothing does reach the search rung", searched2 === 1);
    ok("and the search rung can still resolve it", r4.repo?.full_name === "binwiederhier/ntfy");
    ok("a searched answer is never full confidence", (r4.confidence ?? 1) <= 0.65);
    // Measured wrong 34.1% of the time, so it is a suggestion, not an answer.
    ok("a searched answer is flagged for human review", r4.needsReview === true);

    // ── rung 5, the only rung that can say no
    //
    // Measured without it, the search rung was 34.1% wrong and 0% unresolved:
    // it had no way to decline. These prove it now does.
    const found = async () => [
      "GitHub - famous/alternative https://github.com/famous/alternative the well known one",
    ];
    const askedNothing = '{"candidates":[],"search_query":"a tool that does the job described here"}';
    const ranks = '{"candidates":[{"full_name":"famous/alternative","confidence":0.8}]}';
    const route = (verdict: string): Completer => async (opts) => {
      if (opts.system.startsWith("You are checking whether"))
        return { text: verdict, model: "stub", truncated: false };
      if (opts.system.startsWith("You are given a social media post"))
        return { text: ranks, model: "stub", truncated: false };
      return { text: askedNothing, model: "stub", truncated: false };
    };
    const post = { caption: "the open source thing that does the job everyone wants" };

    const vetoed = await resolveRepo(post, everythingExists, {
      complete: route('{"match":false,"why":"same category, not the project described"}'),
      search: found,
    });
    ok("the verification rung can reject a real repository", vetoed.repo === null);
    ok(
      "a vetoed candidate is reported as real but not the right one",
      vetoed.attempts.some((a) => a.fullName === "famous/alternative" && a.unverified === true),
    );

    const approved = await resolveRepo(post, everythingExists, {
      complete: route('{"match":true,"why":"description matches what the post described"}'),
      search: found,
    });
    ok("an approved candidate still resolves", approved.repo?.full_name === "famous/alternative");

    // The rung's whole problem is over-confidence, so silence must mean no.
    const garbled = await resolveRepo(post, everythingExists, {
      complete: route("I think probably yes?"),
      search: found,
    });
    ok("an unparseable verdict is not treated as approval", garbled.repo === null);

    // But an outage must degrade, not reject — that rule predates this rung.
    const outage: Completer = async (opts) => {
      if (opts.system.startsWith("You are checking whether")) throw new Error("402 balance exhausted");
      if (opts.system.startsWith("You are given a social media post"))
        return { text: ranks, model: "stub", truncated: false };
      return { text: askedNothing, model: "stub", truncated: false };
    };
    const down = await resolveRepo(post, everythingExists, { complete: outage, search: found });
    ok("an unreachable verifier degrades rather than rejecting", down.repo?.full_name === "famous/alternative");
    ok("and says so, at reduced confidence", down.confidence === 0.4 && Boolean(down.modelUnavailable));
    ok("and still asks for human review", down.needsReview === true);
  }

  // The guard must not break the case it was built around: a grounded but
  // mangled name still resolves.
  const repairs: Completer = async () => ({
    text: '{"candidates":[{"full_name":"HKUDS/ViMax","source":"screen","confidence":0.8}]}',
    model: "stub",
    truncated: false,
  });
  const r2 = await resolveRepo({ stillsText: "HKUD5/ViMax" }, everythingExists, {
    complete: repairs,
    search: async () => [],
  });
  ok("a grounded repair still resolves", r2.repo?.full_name === "HKUDS/ViMax");
  ok("a reconstructed answer is not flagged for review", !r2.needsReview);
}

}

main().then(() => {
  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
