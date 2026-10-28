/**
 * How good is Nemotron at "which repository is this post about?"
 *
 * Spends real tokens — every case is at least one Token Factory call, and a
 * case the fast tier misses costs two. Start with `--limit 20`.
 *
 *   npm run eval:resolve -- --limit 20
 *   npm run eval:resolve -- --mode narration
 *   npm run eval:resolve            # the whole corpus
 *
 * Ground truth is the 57 repositories repoherald has really catalogued. The
 * *inputs* are generated (see `corrupt.ts` for why, and for which documented
 * failure each mode reproduces) — so this measures reconstruction from damaged
 * text, not end-to-end production accuracy, and the README says so.
 *
 * The three outcomes are deliberately not two:
 *
 *   correct     resolved, and it is the right repository
 *   WRONG       resolved to a real repository that is not the right one — the
 *               only genuinely harmful outcome, because it enters someone's
 *               list looking exactly like a correct answer
 *   unresolved  no candidate survived GitHub — safe: the post falls back to
 *               the admin queue, which is where it went before any of this
 *
 * An identifier that is unsure and says so is worth more here than one that is
 * usually right, so `WRONG` is reported on its own line and never folded into
 * an accuracy percentage.
 */

import { execFileSync } from "node:child_process";
import { fetchRepoByFullName, type GithubRepo } from "@/lib/github";
import { resolveRepo, type Completer } from "@/lib/resolve-repo";
import { searchForRepo, tavilyConfigured } from "@/lib/tavily";
import { MODELS, nemotronConfigured } from "@/lib/nemotron";
import { buildCases, type Mode } from "./corrupt";
import names from "./fixtures/repo-names.json";

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const limit = Number(flag("limit") ?? "0") || 0;
const onlyMode = flag("mode") as Mode | undefined;

/**
 * `--baseline` runs the corpus with the model stubbed out to return nothing,
 * so only rung 1 — the literal-URL regex — can resolve anything.
 *
 * This is the number the model has to beat, and without it the model's score
 * is unreadable: "72% correct" is excellent if a regex gets 25% and
 * embarrassing if a regex gets 70%. Costs no tokens and needs no key, so it
 * can be run before the credits arrive.
 */
const baselineOnly = argv.includes("--baseline");

/**
 * A real GitHub token, so validation is the real thing. Authenticated gives
 * 5,000 requests an hour; unauthenticated gives 60, which the corpus would
 * exhaust in its first dozen cases.
 */
function githubToken(): string | null {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

async function main() {
  if (!baselineOnly && !nemotronConfigured()) {
    console.error(
      "NEBIUS_API_KEY is not set. Run `npm run nemotron:doctor` first,\n" +
        "or measure the no-model baseline now with `npm run eval:resolve -- --baseline`.",
    );
    process.exit(1);
  }
  const token = githubToken();
  if (!token) {
    console.error(
      "No GitHub token (set GITHUB_TOKEN or run `gh auth login`).\n" +
        "Validation is the whole point of this eval — refusing to run rather than faking it.",
    );
    process.exit(1);
  }

  // A tiny cache: the corpus hits the same 57 repos from four directions, and
  // paying GitHub four times for one answer is just slower, not more correct.
  const cache = new Map<string, GithubRepo | null>();
  const lookup = async (owner: string, repo: string) => {
    const key = `${owner}/${repo}`.toLowerCase();
    if (!cache.has(key)) cache.set(key, await fetchRepoByFullName(token, owner, repo));
    return cache.get(key)!;
  };

  let cases = buildCases(names);
  if (onlyMode) cases = cases.filter((c) => c.mode === onlyMode);
  if (limit) cases = cases.slice(0, limit);

  if (baselineOnly) {
    console.log(`BASELINE — no model, literal github.com links only — ${cases.length} cases`);
    console.log("  this is the bar Nemotron has to clear\n");
  } else {
    console.log(`Nemotron repo identification — ${cases.length} cases`);
    console.log(`  fast: ${MODELS.fast}`);
    console.log(`  deep: ${MODELS.deep}`);
    console.log(`  tavily: ${tavilyConfigured() ? "on" : "off"}\n`);
  }

  /** A model that proposes nothing, so only rung 1 can resolve. */
  const noModel: Completer = async () => ({
    text: '{"candidates":[],"reasoning":"baseline: no model consulted"}',
    model: "baseline",
    promptTokens: 0,
    completionTokens: 0,
  });

  type Tally = { correct: number; wrong: number; unresolved: number; calls: number; tokens: number };
  const blank = (): Tally => ({ correct: 0, wrong: 0, unresolved: 0, calls: 0, tokens: 0 });
  const byMode = new Map<Mode, Tally>();
  const total = blank();
  const wrongExamples: string[] = [];
  const renames: string[] = [];
  /** url-mode cases where the link 404s now, so falling to the model is correct. */
  let urlFellThrough = 0;

  for (const [i, c] of cases.entries()) {
    const t = byMode.get(c.mode) ?? blank();
    const r = await resolveRepo(
      { caption: c.caption, stillsText: c.stillsText, transcript: c.transcript },
      lookup,
      {
        complete: baselineOnly ? noModel : undefined,
        search: baselineOnly || !tavilyConfigured() ? undefined : searchForRepo,
      },
    );

    const got = r.repo?.full_name ?? null;
    let hit = got?.toLowerCase() === c.fullName.toLowerCase();

    // A name that differs may still be the same repository. GitHub 301s a
    // renamed or transferred repo to its current full_name, and fetch follows
    // that redirect — so resolving `MadsLorentzen/ai-job-search` to
    // `ai-job-search-dev/ai-job-search` is the right answer about a repo that
    // moved, not a wrong answer about a repo that didn't. Compare ids before
    // calling it a miss, or the score punishes the resolver for the
    // catalogue's own staleness.
    let renamed = false;
    if (!hit && got && r.repo) {
      const [owner, name] = c.fullName.split("/");
      const canonical = await lookup(owner, name);
      if (canonical && canonical.id === r.repo.id) {
        hit = true;
        renamed = true;
      }
    }

    const outcome = got === null ? "unresolved" : hit ? "correct" : "WRONG";
    if (renamed) renames.push(`${c.fullName} → ${got}`);

    if (outcome === "correct") {
      t.correct++;
      total.correct++;
    } else if (outcome === "WRONG") {
      t.wrong++;
      total.wrong++;
      wrongExamples.push(`${c.mode}: expected ${c.fullName}, got ${got}`);
    } else {
      t.unresolved++;
      total.unresolved++;
    }

    if (c.mode === "caption_url" && r.modelCalls > 0) urlFellThrough++;

    t.calls += r.modelCalls;
    t.tokens += r.tokens;
    total.calls += r.modelCalls;
    total.tokens += r.tokens;
    byMode.set(c.mode, t);

    const mark = outcome === "correct" ? "·" : outcome === "WRONG" ? "✖" : "○";
    process.stdout.write(mark);
    if ((i + 1) % 60 === 0) process.stdout.write(`  ${i + 1}\n`);
  }
  process.stdout.write("\n\n");

  const pct = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(1).padStart(5) : "  n/a");
  const row = (label: string, t: Tally) => {
    const n = t.correct + t.wrong + t.unresolved;
    console.log(
      `  ${label.padEnd(14)} ${String(n).padStart(4)}  ` +
        `correct ${pct(t.correct, n)}%   wrong ${pct(t.wrong, n)}%   unresolved ${pct(t.unresolved, n)}%` +
        `   ${(t.calls / (n || 1)).toFixed(2)} calls/case`,
    );
  };

  console.log("  mode            n   outcome");
  console.log("  " + "─".repeat(86));
  for (const mode of ["caption_url", "caption_plain", "screen", "narration"] as Mode[]) {
    const t = byMode.get(mode);
    if (t) row(mode, t);
  }
  console.log("  " + "─".repeat(86));
  row("ALL", total);
  console.log(`\n  ${total.tokens.toLocaleString()} tokens across ${total.calls} model calls`);

  if (wrongExamples.length) {
    console.log(`\n  ✖ ${wrongExamples.length} confidently wrong — the outcome that matters:`);
    for (const w of wrongExamples.slice(0, 12)) console.log(`     ${w}`);
  } else {
    console.log("\n  ✓ nothing resolved to the wrong repository.");
  }

  if (renames.length) {
    console.log(
      `\n  ↻ ${renames.length} scored correct via GitHub's rename redirect —` +
        ` the catalogue's stored name is stale, the resolver is not:`,
    );
    for (const r of renames) console.log(`     ${r}`);
  }

  // A literal link should cost nothing. It legitimately costs something when
  // the linked repository has since been deleted or made private, because then
  // the ladder is right to carry on — so this reports rather than accuses.
  if (urlFellThrough) {
    console.log(
      `\n  ↓ ${urlFellThrough} linked repositor${urlFellThrough === 1 ? "y no longer resolves" : "ies no longer resolve"},` +
        ` so ${urlFellThrough === 1 ? "that case" : "those cases"} fell through to the model.` +
        ` Every other literal link cost zero model calls, which is the point.`,
    );
  }
}

main();
