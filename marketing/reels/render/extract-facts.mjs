// Reads the ranking formula and credit constants OUT OF the repo so the video
// cannot drift from the code the way the scripts did. Fails loudly: a silently
// missing constant would render a confident, wrong number.
import { readFileSync, writeFileSync } from "node:fs";

const REPO = "/Users/shubhamarundekatey/ClaudeCode/day23/repoherald";
const feed = readFileSync(`${REPO}/src/lib/feed.ts`, "utf8");
const credits = readFileSync(`${REPO}/src/lib/credits.ts`, "utf8");

const must = (re, src, label) => {
  const m = re.exec(src);
  if (!m) throw new Error(`could not find ${label} — refusing to guess`);
  return m[1];
};

// base_score = ln(1 + stars) - hours/48 ; final score = 100.0 * mins/60 + base
const decayHours = must(/\/ 3600\.0 \/ ([\d.]+)\n/, feed, "decay denominator");
const boostMult = must(/\(([\d.]+) \* remaining_minutes/, feed, "highlight multiplier");
const boostDiv = must(/remaining_minutes \/ ([\d.]+) \+ base_score/, feed, "highlight divisor");

const facts = {
  generatedAt: new Date().toISOString().slice(0, 10),
  decayHours: Number(decayHours),
  boostMult: Number(boostMult),
  boostDiv: Number(boostDiv),
  selfMinutes: Number(must(/SELF_HIGHLIGHT_MINUTES = (\d+)/, credits, "self minutes")),
  donationMinutes: Number(must(/DONATION_MINUTES = (\d+)/, credits, "donation minutes")),
  dailyCap: Number(must(/DAILY_MINT_CAP = (\d+)/, credits, "daily cap")),
  weeklyCap: Number(must(/WEEKLY_MINT_CAP = (\d+)/, credits, "weekly cap")),
};

// The two numbers the script claims on camera. Computed, never typed.
const d = (a, b) => Math.log(1 + b) - Math.log(1 + a);
facts.lnSmall = d(10, 20).toFixed(2);
facts.lnLarge = d(1000, 1010).toFixed(2);
facts.formula = `ln(1 + stars) − age_hours/${facts.decayHours} + ${facts.boostMult} × minutes/${facts.boostDiv}`;

writeFileSync("facts.json", JSON.stringify(facts, null, 2));
console.log(JSON.stringify(facts, null, 2));
