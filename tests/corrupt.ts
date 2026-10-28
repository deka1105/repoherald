/**
 * Synthetic corruption of known-good repository names.
 *
 * The 57 names in `fixtures/repo-names.json` are real: they are the repos
 * repoherald has actually catalogued, pulled from the production database, and
 * each one was identified by a person reading a post. What is *not* preserved
 * anywhere is the mangled text those people read — repoherald's
 * `ingest_sightings` records `post_url` and `found_in` but never the caption,
 * OCR or transcript, and repoHeraldIG's local store is empty.
 *
 * So the inputs here are generated, not collected, and the README and the demo
 * video both say so. They are not invented freely: each mode reproduces a
 * failure that repoHeraldIG's own README documents having hit in production.
 *
 * Deterministic on purpose — a seeded generator means the accuracy figure is
 * reproducible by a judge running the same command, rather than a number that
 * moves every time it is quoted.
 */

export type Mode =
  | "caption_url"
  | "caption_plain"
  | "screen"
  | "narration"
  | "described_only";

export type Case = {
  fullName: string;
  mode: Mode;
  caption?: string;
  stillsText?: string;
  transcript?: string;
};

/**
 * The "named nowhere" corpus, for the search rung.
 *
 * Unlike the four modes below, these inputs are **not** synthetic: they are the
 * real GitHub descriptions of repositories repoherald has catalogued, with
 * every occurrence of the owner and repository name scrubbed out
 * (`fixtures/repo-descriptions.json`). That makes them exactly the case the
 * other rungs cannot touch — a post that says what a tool does and never says
 * what it is called. Reconstructing a name that was never present is
 * impossible by definition, so anything resolved here is attributable to
 * search and nothing else.
 */
export function buildDescribedCases(
  entries: { fullName: string; description: string }[],
  seed = 20261028,
): Case[] {
  const rand = rng(seed);
  return entries.map(({ fullName, description }) => {
    const frame = DESCRIBED_FRAMES[Math.floor(rand() * DESCRIBED_FRAMES.length)];
    return {
      fullName,
      mode: "described_only" as const,
      ...frame(description),
    };
  });
}

const DESCRIBED_FRAMES: ((d: string) => Partial<Case>)[] = [
  (d) => ({ caption: `the open source tool nobody is talking about 👇\n\n${d}\n\nsave this #opensource` }),
  (d) => ({ transcript: `okay so this one is completely free and open source, ${d.toLowerCase()}, link is in my bio` }),
  (d) => ({
    caption: "stop paying for this one 🔥 #devtools #opensource",
    transcript: `it is open source and self hosted, ${d.toLowerCase()}`,
  }),
];

/** Mulberry32 — small, seedable, and good enough to shuffle text with. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CAPTION_FRAMES = [
  (n: string) => `This one is actually free 👇\n\nhttps://github.com/${n}\n\n#opensource #devtools`,
  (n: string) => `Stop paying for this.\ngithub.com/${n}\nSave this before you lose it.`,
  (n: string) => `3 tools I use every day\n\n1. ${n} — https://github.com/${n}\n\nFollow for more.`,
];

const PLAIN_FRAMES = [
  (n: string) => `you need to see ${n}, it replaces an entire paid stack`,
  (n: string) => `${n} is the one everybody sleeps on. self-hosted, MIT, zero config`,
  (n: string) => `found ${n} last night and I have not stopped using it since`,
];

/**
 * OCR damage. Tesseract on a compressed reel still confuses the same glyph
 * pairs it always has, and drops characters at frame boundaries.
 */
const OCR_PAIRS: [RegExp, string][] = [
  [/l/g, "1"],
  [/I/g, "l"],
  [/O/g, "0"],
  [/rn/g, "m"],
  [/S/g, "5"],
  [/B/g, "8"],
];

function mangleOcr(name: string, rand: () => number): string {
  let out = name;
  // One or two substitutions, not all of them: a name where every glyph is
  // wrong is not a hard case, it is an unreadable one.
  const picks = OCR_PAIRS.filter(() => rand() < 0.34).slice(0, 2);
  for (const [pattern, replacement] of picks) out = out.replace(pattern, replacement);
  // Occasionally lose a character, the way a blurred frame does.
  if (rand() < 0.3 && out.length > 6) {
    const at = 1 + Math.floor(rand() * (out.length - 2));
    out = out.slice(0, at) + out.slice(at + 1);
  }
  return out;
}

/**
 * Whisper damage. The README's example is the canonical one: `yt-dlp/yt-dlp`
 * comes back as "yt dlp slash yt dlp" — the slash is spoken aloud, the hyphens
 * are not spoken at all. Dots and underscores behave the same way.
 */
function mangleNarration(name: string): string {
  return name
    .replace(/\//g, " slash ")
    .replace(/\./g, " dot ")
    .replace(/[-_]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const NARRATION_FRAMES = [
  (n: string) => `okay so if you are tired of paying for this there is a free one called ${n} and it is completely open source`,
  (n: string) => `this is ${n}, you self host it in about five minutes, link is in my bio`,
  (n: string) => `number one on my list is ${n} and honestly it should have way more stars than it does`,
];

/**
 * One case per name per mode, in a fixed order.
 *
 * `caption_url` exists as the control: it must resolve with zero model calls,
 * because a regex reads a URL correctly and spending a token on it would be
 * waste. If that mode ever needs the model, something upstream has regressed.
 */
export function buildCases(names: string[], seed = 20261028): Case[] {
  const rand = rng(seed);
  const cases: Case[] = [];
  for (const fullName of names) {
    const i = Math.floor(rand() * 3);

    cases.push({ fullName, mode: "caption_url", caption: CAPTION_FRAMES[i](fullName) });
    cases.push({ fullName, mode: "caption_plain", caption: PLAIN_FRAMES[i](fullName) });
    cases.push({
      fullName,
      mode: "screen",
      stillsText: [
        "FREE ALTERNATIVE",
        mangleOcr(fullName, rand),
        "github",
        "SAVE THIS",
      ].join("\n"),
    });
    cases.push({
      fullName,
      mode: "narration",
      transcript: NARRATION_FRAMES[i](mangleNarration(fullName)),
    });
  }
  return cases;
}
