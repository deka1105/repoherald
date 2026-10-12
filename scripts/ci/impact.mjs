/**
 * plan — which of this project's invariants does this change put at risk?
 *
 * `.gitlab/duo/mr-review-instructions.yaml` already pairs each invariant with
 * the paths it governs, because Duo Code Review needs that mapping. Rather
 * than keep a second copy that would drift, this reads the same file and uses
 * it to answer a different question, before any job runs: given the diff, what
 * is this change capable of breaking?
 *
 * The answer is written to plan-impact.json so later stages and the review
 * agent can act on it instead of re-deriving it.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const RULES_FILE = ".gitlab/duo/mr-review-instructions.yaml";
const OUT = "plan-impact.json";

/**
 * A deliberately narrow reader for one known file: rule names and their
 * fileFilters. A full YAML parser would be a dependency bought to read eight
 * list entries, and the block scalars in `instructions` are exactly the part
 * we do not need.
 */
function readRules(text) {
  const rules = [];
  let current = null;
  let inFilters = false;

  for (const line of text.split("\n")) {
    const name = line.match(/^-\s+name:\s*(.+?)\s*$/);
    if (name) {
      current = { name: name[1], fileFilters: [] };
      rules.push(current);
      inFilters = false;
      continue;
    }
    if (!current) continue;
    if (/^\s{2}fileFilters:\s*$/.test(line)) { inFilters = true; continue; }
    if (inFilters) {
      const item = line.match(/^\s{4}-\s*["']?([^"']+)["']?\s*$/);
      if (item) { current.fileFilters.push(item[1]); continue; }
      inFilters = false;
    }
  }
  return rules;
}

/** Glob → RegExp. Supports `**`, `*` and `?`, which is all these filters use. */
function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { out += ".*"; i++; if (glob[i + 1] === "/") i++; }
      else out += "[^/]*";
    } else if (c === "?") out += "[^/]";
    else out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

/**
 * The diff this pipeline is actually about. In a merge request GitLab gives us
 * the base it will merge against; on a branch we fall back to the previous
 * commit. Neither is guessed — a wrong base silently reports the wrong change.
 */
function changedFiles() {
  const base = process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA;
  const range = base ? `${base}...HEAD` : "HEAD~1...HEAD";
  try {
    return execSync(`git diff --name-only ${range}`, { encoding: "utf8" })
      .split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    console.log(`plan: could not diff ${range} — shallow clone or first commit.`);
    return [];
  }
}

const rules = readRules(readFileSync(RULES_FILE, "utf8"));
const files = changedFiles();

const matched = rules
  .map((rule) => {
    const patterns = rule.fileFilters.map(globToRegExp);
    const hits = files.filter((f) => patterns.some((p) => p.test(f)));
    return { invariant: rule.name, files: hits };
  })
  .filter((r) => r.files.length > 0);

const report = {
  generatedAt: new Date().toISOString(),
  commit: process.env.CI_COMMIT_SHA ?? null,
  mergeRequest: process.env.CI_MERGE_REQUEST_IID ?? null,
  changedFiles: files.length,
  invariantsAtRisk: matched,
};
writeFileSync(OUT, JSON.stringify(report, null, 2));

console.log(`plan: ${files.length} file(s) changed, ${rules.length} invariants known\n`);
if (matched.length === 0) {
  console.log("No governed path touched. The usual review still applies; none of the\n" +
              "project's recorded invariants are implicated by this diff.");
} else {
  console.log(`${matched.length} invariant(s) implicated — review these first:\n`);
  for (const m of matched) {
    console.log(`  ${m.invariant}`);
    for (const f of m.files) console.log(`      ${f}`);
  }
}
console.log(`\nWritten to ${OUT}`);
