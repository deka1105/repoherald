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

/**
 * The model call, injectable for the same reason `lookup` is: the ladder's
 * logic — the deep-tier retry, the rejected-candidate feedback, the stop on
 * first confirmation — is the part most likely to break, and it should be
 * provable without spending a token or holding a key.
 */
export type Completer = typeof complete;

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
  /**
   * Set when a model call failed and the ladder carried on without it — an
   * exhausted credit balance, a revoked key, an outage. The caller should
   * report this as degraded service rather than as an error, because rung 1
   * still works and a visitor getting a literal link resolved is a better
   * outcome than a 502.
   */
  modelUnavailable?: string;
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
{"candidates":[{"full_name":"owner/repo","source":"caption|screen|narration","confidence":0.0-1.0,"why":"one short sentence"}],"search_query":"...","reasoning":"one or two sentences"}

"search_query" is for the case where the post shows a project and describes
what it does but never names it. Write the query someone would actually type to
find that project: what it does, what it is built with, that it is open source.
Strip hashtags, emoji, "link in bio", "save this" and every other piece of
social-media furniture. Omit the field entirely if the post names a repository
outright — searching is only for when there is no name to read.

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
  search_query: z.string().max(400).optional(),
  reasoning: z.string().optional(),
});

/**
 * Picking a repository out of search results is a different question from
 * reading one out of a caption, so it gets its own prompt. The hard part is
 * discrimination rather than reconstruction: a search for "open source photo
 * editor in Rust" surfaces the right owner's *other* project as readily as the
 * right one, and only the post's own wording separates them.
 */
const PICK_SYSTEM = `You are given a social media post about an open-source project that never names it, and web search results.

Decide which result IS the project the post is about.

Return JSON only:
{"candidates":[{"full_name":"owner/repo","confidence":0.0-1.0,"why":"one short sentence"}],"reasoning":"one or two sentences"}

Rules:
- Only propose repositories that appear in the search results. Do not invent one.
- Order best first, at most 3.
- Watch for near misses: the same owner often has several similar projects, and
  the post's own description is the only thing that tells them apart.
- If no result matches what the post describes, return {"candidates":[]}.
- Never exceed 0.9 confidence.`;

const pickSchema = z.object({
  candidates: z
    .array(
      z.object({
        full_name: z.string(),
        confidence: z.number().min(0).max(1).catch(0.5),
        why: z.string().optional(),
      }),
    )
    .max(5),
  reasoning: z.string().optional(),
});

/**
 * Social-media furniture, stripped so a fallback query is about the software
 * rather than the post. Only used when there is no model to write a better one.
 */
function naiveQuery(text: string): string {
  return text
    .replace(/^(caption|screen|narration):/gim, " ")
    .replace(/#[\w]+/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b(link in bio|save this|follow for more|comment below|stop paying for this)\b/gi, " ")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/[^\p{L}\p{N}\s.\-_/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

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
  opts: { search?: WebSearch; complete?: Completer } = {},
): Promise<Resolution> {
  const ask = opts.complete ?? complete;
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

  if (!opts.complete && !nemotronConfigured()) {
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
  let searchQuery: string | undefined;
  let modelUnavailable: string | undefined;

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

    let out: Awaited<ReturnType<Completer>>;
    try {
      out = await ask({ tier, system: SYSTEM, user: prompt });
    } catch (err) {
      // Both tiers sit behind the same endpoint and the same balance, so if one
      // call fails for anything other than its own content, the other will too.
      // Stop asking and fall through to the search rung, which can still work:
      // its query has a model-free fallback and its ranking already degrades to
      // reading links out of the results.
      modelUnavailable = err instanceof Error ? err.message : "model call failed";
      break;
    }
    modelCalls++;
    tokens += (out.promptTokens ?? 0) + (out.completionTokens ?? 0);

    const parsed = extractJson(out.text, candidatesSchema);
    if (parsed?.reasoning) reasoning = parsed.reasoning;
    // Asked for in the same completion as the candidates, so a post that turns
    // out to name nothing has already paid for its search query.
    if (parsed?.search_query?.trim()) searchQuery = parsed.search_query.trim();

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
  //
  // The rungs above can only reconstruct a name that is present somewhere in
  // the text. When a reel shows a tool, says what it does, and never once says
  // what it is called, there is nothing to reconstruct — searching for the
  // description is the only remaining route to an answer.
  if (opts.search) {
    const query = searchQuery || naiveQuery(body);

    // A post that is nothing but hashtags and "link in bio" leaves no query
    // once the furniture is stripped. Searching for an empty string spends a
    // Tavily call to learn nothing, so don't.
    const results = query.length >= 12 ? await opts.search(query) : [];

    if (results.length) {
      // Ask the model which result is the project, rather than taking the
      // first GitHub link. Search for "open source photo editor in Rust"
      // returns the right owner's *other* project just as readily as the right
      // one, and only the post's own wording tells them apart — regexing the
      // first URL would pick by result order, which is not evidence.
      let ranked: string[] = [];
      try {
        const pick = await ask({
          tier: "deep",
          system: PICK_SYSTEM,
          user: `post:\n${body}\n\n---\n\nsearch results for "${query}":\n${results
            .slice(0, 8)
            .map((r, i) => `${i + 1}. ${r}`)
            .join("\n")}`,
        });
        modelCalls++;
        tokens += (pick.promptTokens ?? 0) + (pick.completionTokens ?? 0);
        const parsed = extractJson(pick.text, pickSchema);
        if (parsed?.reasoning) reasoning = parsed.reasoning;
        ranked = (parsed?.candidates ?? [])
          .map((c) => normaliseFullName(c.full_name))
          .filter((n): n is string => Boolean(n));
      } catch {
        // A failure here costs the ranking, not the rung — fall through to
        // reading links straight out of the results.
        ranked = [];
      }

      // The model's ranking first, then anything else the results mentioned.
      const fromResults = urlsIn(results.join("\n"));
      for (const fullName of [...ranked, ...fromResults]) {
        const repo = await check(fullName, "caption", "web-search");
        if (repo) {
          const wasRanked = ranked.includes(fullName);
          return {
            repo,
            foundIn: "caption",
            // Lower than a reconstructed name on purpose: the post never said
            // this, so the claim rests on a search result matching a
            // description, which is weaker evidence than reading a name.
            confidence: wasRanked ? 0.65 : 0.5,
            reasoning:
              reasoning ||
              `The post described the project without naming it. Searching for "${query}" surfaced ${repo.full_name}, which GitHub confirms exists.`,
            attempts,
            modelCalls,
            tokens,
            modelUnavailable,
          };
        }
      }
    }
  }

  return {
    repo: null,
    foundIn: null,
    confidence: 0,
    reasoning: modelUnavailable
      ? "No literal repository link in the text, and the model could not be reached — so the rungs that reconstruct a mangled or spoken name did not run."
      : reasoning ||
        `No candidate resolved. Tried: ${attempts.map((a) => a.fullName).join(", ") || "nothing"}.`,
    attempts,
    modelCalls,
    tokens,
    modelUnavailable,
  };
}
