/**
 * Which repository is this post about?
 *
 * This is the step repoherald has always done by hand. The landing page says
 * so out loud — *"A person looks up the repository behind it"* — and that
 * person is the reason the catalogue cannot grow faster than someone's
 * evening.
 *
 * The inputs are the three places a repo can be named, in descending fidelity
 * (the table in repoHeraldIG's README):
 *
 *   caption     highest — often a literal github.com URL
 *   screen      near-verbatim OCR of the stills, with mangled characters
 *   narration   lossiest — Whisper, where `yt-dlp/yt-dlp` arrives as
 *               "yt dlp slash yt dlp": the slash is spoken, the hyphens are not
 *
 * The one rule that makes this safe to automate: **Nemotron proposes, GitHub
 * decides.** Every candidate is checked against `GET /repos/{owner}/{repo}`
 * and a candidate that does not resolve is discarded, however confident the
 * model sounded. A wrong guess costs one API call; a hallucinated repo in
 * someone's private list costs their trust in the whole product. The model
 * never names the output — it only narrows the search.
 *
 * Pure and injectable on purpose: `lookup` is passed in rather than imported,
 * so the eval harness can run the whole ladder against a fixed repo table
 * without a GitHub token, and so nothing here needs the database.
 */

import { z } from "zod";
import type { GithubRepo } from "@/lib/github";
import { complete, extractJson, nemotronConfigured } from "@/lib/nemotron";

/** Where a repo reference was found. Mirrors `ingest_sightings.found_in`. */
export type FoundIn = "caption" | "screen" | "narration";

export type PostText = {
  caption?: string | null;
  stillsText?: string | null;
  transcript?: string | null;
};

export type RepoLookup = (
  ownerLogin: string,
  repoName: string,
) => Promise<GithubRepo | null>;

/** Optional web search, used only when the text names no resolvable repo. */
export type WebSearch = (query: string) => Promise<string[]>;

export type Attempt = {
  fullName: string;
  source: FoundIn;
  /** How the candidate was produced, for the audit trail and the demo. */
  via: "url" | "model-fast" | "model-deep" | "web-search";
  resolved: boolean;
};

export type Resolution = {
  repo: GithubRepo | null;
  foundIn: FoundIn | null;
  /** 1.0 only for a literal URL that resolved; the model never sets it above 0.9. */
  confidence: number;
  reasoning: string;
  attempts: Attempt[];
  modelCalls: number;
  tokens: number;
};

const SYSTEM = `You identify which GitHub repository a social media post is about.

You are given up to three texts from one post, in descending reliability:
- caption: written text, often contains a literal github.com URL
- screen: OCR of frames from the video; characters are frequently mangled
- narration: a speech-to-text transcript; punctuation inside repository names
  is SPOKEN not written. "yt dlp slash yt dlp" means "yt-dlp/yt-dlp": the
  slash was said aloud, the hyphens were not said at all. Reconstruct hyphens,
  dots and underscores that a speaker would never pronounce.

Return JSON only, no prose:
{"candidates":[{"full_name":"owner/repo","source":"caption|screen|narration","confidence":0.0-1.0,"why":"one short sentence"}],"reasoning":"one or two sentences"}

Rules:
- Order candidates best first. Up to 5. Include spelling variants when unsure
  — a wrong guess is cheap, a missed repository loses the whole post.
- full_name must be exactly owner/repo, no URL, no trailing .git, no branch.
- Never exceed 0.9 confidence; you cannot verify a repository exists.
- If the post names no repository at all, return {"candidates":[],"reasoning":"..."}.`;

const candidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        full_name: z.string(),
        source: z.enum(["caption", "screen", "narration"]).catch("caption"),
        confidence: z.number().min(0).max(1).catch(0.5),
        why: z.string().optional(),
      }),
    )
    .max(8),
  reasoning: z.string().optional(),
});

/** `owner/repo`, the only shape GitHub will accept. */
const FULL_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;

/** Strips the things people paste around a repo name. */
function normaliseFullName(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/^github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/[)\]},.]+$/, "")
    .split(/[?#]/)[0]
    .split("/")
    .slice(0, 2)
    .join("/");
  return FULL_NAME.test(cleaned) ? cleaned : null;
}

/** Literal github.com URLs, which need no model at all. */
export function urlsIn(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const m of text.matchAll(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100})/gi,
  )) {
    const full = normaliseFullName(m[1]);
    if (full && !out.includes(full)) out.push(full);
  }
  return out;
}

function describe(text: PostText): string {
  const parts: string[] = [];
  if (text.caption?.trim()) parts.push(`caption:\n${text.caption.trim()}`);
  if (text.stillsText?.trim()) parts.push(`screen:\n${text.stillsText.trim()}`);
  if (text.transcript?.trim())
    parts.push(`narration:\n${text.transcript.trim()}`);
  return parts.join("\n\n---\n\n");
}

/**
 * Resolves a post to a repository, cheapest path first.
 *
 * 1. A literal github.com URL in the caption — a regex is correct here, and
 *    spending a token to read a URL would be silly.
 * 2. Nemotron fast tier over all three texts.
 * 3. Nemotron deep tier, told which candidates GitHub already rejected, so it
 *    repairs rather than repeating itself. This is the rung that fixes
 *    spoken-punctuation damage.
 * 4. Web search, when the text describes a project without naming it.
 *
 * Stops at the first candidate GitHub confirms.
 */
export async function resolveRepo(
  text: PostText,
  lookup: RepoLookup,
  opts: { search?: WebSearch } = {},
): Promise<Resolution> {
  const attempts: Attempt[] = [];
  let modelCalls = 0;
  let tokens = 0;

  const tried = new Set<string>();
  const check = async (
    fullName: string,
    source: FoundIn,
    via: Attempt["via"],
  ): Promise<GithubRepo | null> => {
    const key = fullName.toLowerCase();
    if (tried.has(key)) return null;
    tried.add(key);
    const [owner, name] = fullName.split("/");
    let repo: GithubRepo | null = null;
    try {
      repo = await lookup(owner, name);
    } catch {
      // A lookup failure is not a rejection — it just means this candidate is
      // unproven, so the ladder keeps going rather than reporting "no repo".
      repo = null;
    }
    attempts.push({ fullName, source, via, resolved: Boolean(repo) });
    return repo;
  };

  // ── 1. a literal URL, in fidelity order
  const sources: [FoundIn, string | null | undefined][] = [
    ["caption", text.caption],
    ["screen", text.stillsText],
    ["narration", text.transcript],
  ];
  for (const [source, body] of sources) {
    for (const fullName of urlsIn(body)) {
      const repo = await check(fullName, source, "url");
      if (repo) {
        return {
          repo,
          foundIn: source,
          confidence: 1,
          reasoning: `The ${source} contains a literal github.com link to ${repo.full_name}, and GitHub confirms it exists.`,
          attempts,
          modelCalls,
          tokens,
        };
      }
    }
  }

  const body = describe(text);
  if (!body.trim()) {
    return {
      repo: null,
      foundIn: null,
      confidence: 0,
      reasoning: "The post carried no caption, no on-screen text and no narration.",
      attempts,
      modelCalls,
      tokens,
    };
  }

  if (!nemotronConfigured()) {
    return {
      repo: null,
      foundIn: null,
      confidence: 0,
      reasoning:
        "No literal repository link, and NEBIUS_API_KEY is unset so no model pass ran.",
      attempts,
      modelCalls,
      tokens,
    };
  }

  let reasoning = "";

  // ── 2 & 3. the model, fast then deep
  for (const tier of ["fast", "deep"] as const) {
    const rejected = attempts
      .filter((a) => !a.resolved)
      .map((a) => a.fullName);

    const prompt =
      tier === "fast"
        ? body
        : `${body}\n\n---\n\nThese candidates were already checked against the GitHub API and DO NOT EXIST:\n${rejected
            .map((r) => `- ${r}`)
            .join("\n")}\n\nThey are wrong. Reconstruct the repository name differently — pay particular attention to punctuation a speaker would pronounce aloud (a spoken "slash", "dot" or "dash") and to hyphens that are never pronounced at all.`;

    const out = await complete({ tier, system: SYSTEM, user: prompt });
    modelCalls++;
    tokens += (out.promptTokens ?? 0) + (out.completionTokens ?? 0);

    const parsed = extractJson(out.text, candidatesSchema);
    if (parsed?.reasoning) reasoning = parsed.reasoning;

    for (const candidate of parsed?.candidates ?? []) {
      const fullName = normaliseFullName(candidate.full_name);
      if (!fullName) continue;
      const repo = await check(
        fullName,
        candidate.source,
        tier === "fast" ? "model-fast" : "model-deep",
      );
      if (repo) {
        return {
          repo,
          foundIn: candidate.source,
          // The model's own confidence, kept below 1 — only a literal URL earns that.
          confidence: Math.min(candidate.confidence, 0.9),
          reasoning:
            candidate.why ||
            reasoning ||
            `Identified ${repo.full_name} from the ${candidate.source}.`,
          attempts,
          modelCalls,
          tokens,
        };
      }
    }
  }

  // ── 4. web search, for a post that describes a project without naming it
  if (opts.search) {
    const results = await opts.search(body.slice(0, 500));
    if (results.length) {
      for (const fullName of urlsIn(results.join("\n"))) {
        const repo = await check(fullName, "caption", "web-search");
        if (repo) {
          return {
            repo,
            foundIn: "caption",
            confidence: 0.6,
            reasoning: `The post described the project without naming it; a web search surfaced ${repo.full_name}, which GitHub confirms.`,
            attempts,
            modelCalls,
            tokens,
          };
        }
      }
    }
  }

  return {
    repo: null,
    foundIn: null,
    confidence: 0,
    reasoning:
      reasoning ||
      `No candidate resolved. Tried: ${attempts.map((a) => a.fullName).join(", ") || "nothing"}.`,
    attempts,
    modelCalls,
    tokens,
  };
}
