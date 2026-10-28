/**
 * Tavily — the last rung of repo identification.
 *
 * Some posts never name the repository at all. A reel says "this free tool
 * turns your screenshots into editable designs", shows the UI, and never puts
 * a name on screen or in the caption. No amount of reading the text will
 * recover a name that was never there; the only way to it is to search for the
 * description and see what comes back.
 *
 * Returns raw result text rather than parsed repos on purpose — whatever it
 * finds still goes through `resolveRepo`'s GitHub check before it can become
 * an answer. Search is a source of guesses, not a source of truth.
 *
 * UNSET key = this rung is skipped and the post goes to the admin queue
 * unidentified, which is exactly what happened before this existed.
 */

import { z } from "zod";

const ENDPOINT = "https://api.tavily.com/search";
const TIMEOUT_MS = 20_000;

const responseSchema = z.object({
  results: z
    .array(
      z.object({
        title: z.string().optional(),
        url: z.string().optional(),
        content: z.string().optional(),
      }),
    )
    .default([]),
});

export function tavilyConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

/**
 * Searches for a project by description, biased towards GitHub.
 *
 * Returns one string per result (title, url and snippet joined) so the caller
 * can run its URL extraction over the lot.
 */
export async function searchForRepo(description: string): Promise<string[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `${description.slice(0, 350)} github repository`,
        search_depth: "basic",
        max_results: 5,
        include_domains: ["github.com"],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // A search outage must not fail identification — it only removes the last
    // rung, and the rungs above it already had their turn.
    return [];
  }

  if (!res.ok) return [];
  const parsed = responseSchema.safeParse(await res.json());
  if (!parsed.success) return [];

  return parsed.data.results.map((r) =>
    [r.title, r.url, r.content].filter(Boolean).join(" "),
  );
}
