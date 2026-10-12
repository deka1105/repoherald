/**
 * configure — does the deployment contract match what the code actually reads?
 *
 * `.env.example` is the only document telling someone what this app needs to
 * run. It drifts in two directions and both cost real time:
 *
 *   used but not declared  — the app reads a variable nobody knew to set. It
 *                            fails at runtime, in production, usually quietly.
 *   declared but not used  — the example file asks for secrets the app stopped
 *                            needing. People go and provision them anyway.
 *
 * The first is a deploy hazard, so it fails the job. The second is untidiness
 * that misleads, so it warns.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const SOURCE_DIRS = ["src"];
const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const EXAMPLE = ".env.example";

/**
 * Variables consumed by a framework rather than by our code, so they never
 * appear as `process.env.X` and would otherwise look dead. Auth.js reads its
 * provider credentials by naming convention.
 */
const IMPLICIT = new Set(["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (SOURCE_EXTS.has(extname(path))) out.push(path);
  }
  return out;
}

const used = new Map(); // name -> first file that reads it
for (const dir of SOURCE_DIRS) {
  for (const file of walk(dir)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      if (!used.has(m[1])) used.set(m[1], file);
    }
  }
}

const declared = new Set(
  readFileSync(EXAMPLE, "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z0-9_]+)\s*=/)?.[1])
    .filter(Boolean),
);

const undeclared = [...used.keys()].filter((k) => !declared.has(k)).sort();
const unused = [...declared].filter((k) => !used.has(k) && !IMPLICIT.has(k)).sort();

console.log(`configure: ${used.size} variables read, ${declared.size} declared in ${EXAMPLE}\n`);

if (unused.length) {
  console.log(`⚠︎  declared but never read (${unused.length}) — ${EXAMPLE} asks for more than the app needs:`);
  for (const k of unused) console.log(`     ${k}`);
  console.log("");
}

if (undeclared.length) {
  console.log(`✖  read but not declared (${undeclared.length}) — a fresh deploy has no way to know about these:`);
  for (const k of undeclared) console.log(`     ${k.padEnd(28)} ${used.get(k)}`);
  console.log(`\n   Add them to ${EXAMPLE}, with a comment saying what breaks without them.`);
  process.exit(1);
}

console.log("✓  every variable the code reads is declared.");
