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

async function search(
  key: string,
  query: string,
  restrictToGithub: boolean,
): Promise<{ url?: string; text: string }[]> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        // Basic rather than advanced: this runs on a finite promotional
        // balance, and the job is to surface a handful of candidate links for
        // the model to choose between, not to read pages deeply.
        search_depth: "basic",
        max_results: 5,
        ...(restrictToGithub ? { include_domains: ["github.com"] } : {}),
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

  return parsed.data.results.map((r) => ({
    url: r.url,
    text: [r.title, r.url, r.content].filter(Boolean).join(" "),
  }));
}

/**
 * Finds a project from a description of what it does.
 *
 * Two searches, because the repository gets named in two different kinds of
 * place and neither alone is enough:
 *
 *   restricted to github.com — the repository page itself, when the
 *                             description matches its own README closely
 *   unrestricted            — the listicle, blog post or thread that names the
 *                             project. Often the only hit, because a reel and
 *                             a README rarely describe a tool the same way,
 *                             while an article about it describes it the way
 *                             people talk about it
 *
 * Returns one string per result (title, url and snippet joined) so the caller
 * can both rank them with a model and extract links from them. Deduped by URL,
 * with GitHub's own pages first since they are the stronger evidence.
 */
export async function searchForRepo(description: string): Promise<string[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];

  const query = description.slice(0, 350);
  const [direct, wider] = await Promise.all([
    search(key, `${query} github repository`, true),
    search(key, `${query} open source github`, false),
  ]);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of [...direct, ...wider]) {
    const key = r.url ?? r.text;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r.text);
  }
  return out;
}
