/**
 * NVIDIA Nemotron on Nebius Token Factory — the inference behind repo
 * identification.
 *
 * Token Factory is OpenAI-compatible, so this is a thin fetch wrapper rather
 * than an SDK: the only shapes used are `POST /chat/completions` and
 * `GET /models`, and a dependency that wraps two endpoints is a dependency
 * that has to be upgraded for no reason.
 *
 * Deliberately **not** marked `server-only`. The eval harness in
 * `tests/resolve-repo.test.ts` runs this under `tsx`, outside Next, and
 * `server-only` throws there. The key is instead read lazily inside
 * `apiKey()` rather than captured at import time, and `NEBIUS_API_KEY` has no
 * `NEXT_PUBLIC_` prefix, so Next strips it from any client bundle — importing
 * this from a client component yields a thrown `MissingNebiusKey`, never a
 * leaked secret.
 */

import { z } from "zod";

const DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1";

/** Requests die rather than hang: a wedged identify must not pin a serverless invocation open. */
const TIMEOUT_MS = 60_000;
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;

/**
 * Model tiers.
 *
 * Identification is two-speed for the same reason repoHeraldIG's parsing is:
 * most posts name the repo plainly in the caption and need the cheap pass,
 * while a minority arrive as mangled OCR or spoken narration and need real
 * reasoning to repair.
 *
 * Both default to the one id verified against Token Factory's published
 * catalogue. The catalogue changes, and the docs say to query `/models`
 * rather than hardcode, so these are env-overridable and `checkModels()`
 * verifies them against the live list instead of trusting a constant that was
 * true the week it was written.
 */
export const MODELS = {
  fast: process.env.NEMOTRON_MODEL_FAST || "nvidia/nemotron-3-super-120b-a12b",
  deep: process.env.NEMOTRON_MODEL_DEEP || "nvidia/nemotron-3-super-120b-a12b",
} as const;

export type Tier = keyof typeof MODELS;

export class MissingNebiusKey extends Error {
  constructor() {
    super("NEBIUS_API_KEY is not set — repo identification is unavailable");
  }
}
export class NebiusError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Nebius Token Factory returned ${status}: ${body.slice(0, 300)}`);
  }
}
export class NebiusRateLimited extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Nebius Token Factory rate limited");
  }
}

function apiKey(): string {
  const key = process.env.NEBIUS_API_KEY;
  if (!key) throw new MissingNebiusKey();
  return key;
}

function baseUrl(): string {
  // Some accounts are issued a region-suffixed host (for example
  // api.tokenfactory.us-central1.nebius.com). The dashboard is the only place
  // that tells you which, so it stays configurable.
  return (process.env.NEBIUS_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/** True when inference is configured at all, so callers can degrade instead of throwing. */
export function nemotronConfigured(): boolean {
  return Boolean(process.env.NEBIUS_API_KEY);
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

function retryAfter(res: Response): number {
  const header = Number(res.headers.get("retry-after"));
  return Number.isFinite(header) && header > 0 ? header : 2;
}

/**
 * Retries rate limits and server errors only.
 *
 * Identification is a pure read — it stores nothing and moves nothing — so a
 * retry cannot double anything. That is the only reason this loop is safe
 * without an idempotency key.
 */
async function withRetries(path: string, init: RequestInit): Promise<Response> {
  let last: Error | null = null;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await request(path, init);
    } catch (err) {
      // Timeouts and transport faults are worth one more try; a bad key is not.
      last = err as Error;
      if (err instanceof MissingNebiusKey) throw err;
      if (attempt === RETRY_ATTEMPTS) throw err;
      await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
      continue;
    }

    if (res.ok) return res;
    if (res.status === 401 || res.status === 403) {
      throw new NebiusError(res.status, await res.text());
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt === RETRY_ATTEMPTS) {
        if (res.status === 429) throw new NebiusRateLimited(retryAfter(res));
        throw new NebiusError(res.status, await res.text());
      }
      const wait =
        res.status === 429
          ? retryAfter(res) * 1000
          : RETRY_BASE_MS * 2 ** (attempt - 1);
      await sleep(wait);
      continue;
    }
    // Any other 4xx is our fault and will not fix itself.
    throw new NebiusError(res.status, await res.text());
  }
  throw last ?? new Error("Nebius request failed");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const completionSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
    })
    .optional(),
});

export type Completion = {
  text: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
};

/** One chat completion. Returns the assistant text, or throws. */
export async function complete(opts: {
  tier: Tier;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<Completion> {
  const model = MODELS[opts.tier];
  const res = await withRetries("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      // Identification is extraction, not writing. Near-zero temperature keeps
      // the same mangled caption resolving to the same repo across runs, which
      // is what makes the accuracy number in the eval mean anything.
      temperature: opts.temperature ?? 0,
      max_tokens: opts.maxTokens ?? 800,
    }),
  });

  const parsed = completionSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new NebiusError(200, `unexpected completion shape: ${parsed.error.message}`);
  }
  return {
    text: parsed.data.choices[0].message.content ?? "",
    model,
    promptTokens: parsed.data.usage?.prompt_tokens,
    completionTokens: parsed.data.usage?.completion_tokens,
  };
}

/**
 * Pulls the first JSON object out of a completion and validates it.
 *
 * Token Factory advertises OpenAI compatibility but its published API
 * reference does not document `response_format: json_schema`, so this does
 * not depend on strict structured output being honoured. The model is asked
 * for JSON, the first balanced object is extracted (models wrap JSON in prose
 * and fenced blocks no matter how firmly you ask them not to), and zod is the
 * thing that actually decides whether the result is usable.
 */
export function extractJson<T>(text: string, schema: z.ZodType<T>): T | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  // Balance braces rather than regex: a repo description containing a brace
  // would defeat a lazy match, and descriptions come straight from GitHub.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return schema.parse(JSON.parse(text.slice(start, i + 1)));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * The ids Token Factory will actually serve this account.
 *
 * Used by `npm run nemotron:doctor` so a wrong model id fails with a list of
 * the right ones instead of a 404 at the moment someone sends a post.
 */
export async function listModels(): Promise<string[]> {
  const res = await withRetries("/models", { method: "GET" });
  const body = z
    .object({ data: z.array(z.object({ id: z.string() })) })
    .safeParse(await res.json());
  if (!body.success) return [];
  return body.data.data.map((m) => m.id).sort();
}

/** Which configured tiers are missing from the live catalogue. */
export async function checkModels(): Promise<{
  available: string[];
  missing: { tier: Tier; model: string }[];
}> {
  const available = await listModels();
  const missing = (Object.keys(MODELS) as Tier[])
    .filter((tier) => !available.includes(MODELS[tier]))
    .map((tier) => ({ tier, model: MODELS[tier] }));
  return { available, missing };
}
