import { NextResponse } from "next/server";
import { fetchPublicRepo } from "@/lib/github";
import { nemotronConfigured } from "@/lib/nemotron";
import { resolveRepo } from "@/lib/resolve-repo";
import { searchForRepo, tavilyConfigured } from "@/lib/tavily";
import { visitorHash } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Identify which GitHub repository a post is about.
 *
 * Public on purpose: this is the thing repoherald used to do by hand, and a
 * judge or a visitor should be able to put a mangled caption in and watch the
 * ladder work without creating an account first.
 *
 * Public also means it spends money, so it is capped twice (below). And it
 * means arbitrary text reaches a model — which is a small surface by
 * construction rather than by trust: the only thing this endpoint can emit is
 * an `owner/repo` that GitHub independently confirms exists. Text that talks
 * the model into naming something else produces a 404 and no result. There is
 * no tool here to misuse, nothing is written, and nothing is charged.
 */

/** Longer than any real caption, OCR dump or transcript worth reading. */
const MAX_FIELD = 2_000;

/**
 * Two ceilings, both in memory.
 *
 * Per-visitor stops one person hammering it. The global one is the real guard:
 * the credit balance behind this is finite, and an endpoint that can empty it
 * in an afternoon is not a demo, it is an outage waiting for the judging
 * window. Serverless means several instances each keep their own counters, so
 * these are soft limits — deliberately set low enough that even a handful of
 * instances cannot add up to a problem.
 *
 * Nothing here is written to the database. The key is the same salted daily
 * hash the view counter uses, held in memory for an hour and never persisted,
 * so /privacy's promise that an IP is never written to our database stays true.
 */
/**
 * The global figure is sized against the judging window, not against a busy
 * day. A full identification runs one or two model calls at roughly 800
 * tokens, so 60 a day is about 50k tokens a day — a promotional balance
 * survives several weeks of that, where 300 a day could drain it inside one.
 * The demo being a little stingy beats the demo being dead on the day somebody
 * opens the link.
 */
const PER_VISITOR = { limit: 10, windowMs: 60 * 60 * 1000 };
const GLOBAL = { limit: 60, windowMs: 24 * 60 * 60 * 1000 };

const visitors = new Map<string, { count: number; resetAt: number }>();
let globalWindow = { count: 0, resetAt: Date.now() + GLOBAL.windowMs };

function overLimit(key: string): string | null {
  const now = Date.now();

  if (now > globalWindow.resetAt) {
    globalWindow = { count: 0, resetAt: now + GLOBAL.windowMs };
  }
  if (globalWindow.count >= GLOBAL.limit) {
    return "This demo has hit its daily identification budget. Try again tomorrow, or run it locally — the repository has instructions.";
  }

  const seen = visitors.get(key);
  if (!seen || now > seen.resetAt) {
    visitors.set(key, { count: 1, resetAt: now + PER_VISITOR.windowMs });
  } else if (seen.count >= PER_VISITOR.limit) {
    return `That is ${PER_VISITOR.limit} identifications in an hour, which is plenty for a demo. Try again later.`;
  } else {
    seen.count++;
  }

  // Keep the map from growing without bound on a long-lived instance.
  if (visitors.size > 5_000) {
    for (const [k, v] of visitors) if (now > v.resetAt) visitors.delete(k);
  }

  globalWindow.count++;
  return null;
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_FIELD) : null;
}

export async function POST(request: Request) {
  // Neither a missing key nor an unreachable model is an error here. Rung 1 of
  // the ladder is a regex over literal github.com links and needs no model at
  // all, so the easy half keeps working either way — whether the credits have
  // not arrived yet or have run out. A visitor who gets a literal link
  // resolved, over a banner saying the clever part is unavailable, is better
  // served than one who gets a 502. `degraded` tells the page to say which.
  const unconfigured = !nemotronConfigured();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  const caption = clean(input.caption);
  const stillsText = clean(input.stillsText);
  const transcript = clean(input.transcript);
  if (!caption && !stillsText && !transcript) {
    return NextResponse.json(
      { error: "Give me a caption, some on-screen text, or a transcript." },
      { status: 400 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limited = overLimit(visitorHash(ip, request.headers.get("user-agent") ?? ""));
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });

  const started = Date.now();
  try {
    const result = await resolveRepo(
      { caption, stillsText, transcript },
      fetchPublicRepo,
      { search: tavilyConfigured() ? searchForRepo : undefined },
    );

    return NextResponse.json({
      // Only what the page needs to render, so the shape of GithubRepo is not
      // part of a public contract this endpoint has to keep.
      repo: result.repo
        ? {
            fullName: result.repo.full_name,
            description: result.repo.description,
            language: result.repo.language,
            stars: result.repo.stargazers_count,
            archived: result.repo.archived,
            avatarUrl: result.repo.owner.avatar_url,
          }
        : null,
      foundIn: result.foundIn,
      confidence: result.confidence,
      reasoning: result.reasoning,
      attempts: result.attempts,
      modelCalls: result.modelCalls,
      tokens: result.tokens,
      ms: Date.now() - started,
      degraded: unconfigured || Boolean(result.modelUnavailable),
    });
  } catch (err) {
    // The visitor gets a flat message; the detail goes to the logs. A model
    // provider's error text can quote the prompt back, and the prompt here is
    // whatever a stranger typed.
    console.error("identify failed", err);
    return NextResponse.json(
      { error: "Identification failed. That is on us — try again shortly." },
      { status: 502 },
    );
  }
}
