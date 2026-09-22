import { NextResponse } from "next/server";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { highlights, repos, sponsorships, starMints } from "@/db/schema";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

/**
 * Public detail for one listed repo, used by the extension only AFTER its local
 * catalogue says the repo is listed. That ordering is the privacy property: we
 * are only ever asked about repos that are already public on our own feed, so
 * this endpoint cannot be used to reconstruct someone's browsing.
 *
 * Everything returned is visible on the public repo page. Deliberately NOT
 * recorded as an analytics event — a lookup is not a page view, and counting it
 * would inflate the numbers listing authors rely on.
 */
export async function GET(request: Request) {
  const fullName = new URL(request.url).searchParams.get("full_name")?.trim().toLowerCase();
  if (!fullName || !/^[\w.-]+\/[\w.-]+$/.test(fullName)) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400, headers: CORS });
  }

  const [repo] = await db
    .select({
      id: repos.id,
      fullName: repos.fullName,
      description: repos.description,
      starsCount: repos.starsCount,
      primaryLanguage: repos.primaryLanguage,
    })
    .from(repos)
    .where(and(eq(repos.status, "active"), sql`lower(${repos.fullName}) = ${fullName}`))
    .limit(1);

  if (!repo) {
    return NextResponse.json({ listed: false }, { headers: CORS });
  }

  const now = new Date();
  const [[mints], [live], [sponsored]] = await Promise.all([
    db
      .select({ n: count() })
      .from(starMints)
      .where(and(eq(starMints.repoId, repo.id), eq(starMints.status, "minted"))),
    // Highlight status is always derived from the timestamps, never the status
    // column (which is reporting-only).
    db
      .select({ n: count() })
      .from(highlights)
      .where(
        and(
          eq(highlights.repoId, repo.id),
          sql`${highlights.startsAt} <= ${now}`,
          gt(highlights.endsAt, now)
        )
      ),
    db
      .select({ n: count() })
      .from(sponsorships)
      .where(
        and(
          eq(sponsorships.repoId, repo.id),
          eq(sponsorships.status, "active"),
          gt(sponsorships.endsAt, now)
        )
      ),
  ]);

  return NextResponse.json(
    {
      listed: true,
      repo: {
        fullName: repo.fullName,
        description: repo.description,
        primaryLanguage: repo.primaryLanguage,
        starsCount: repo.starsCount,
        starsClaimed: mints?.n ?? 0,
        highlighted: (live?.n ?? 0) > 0,
        sponsored: (sponsored?.n ?? 0) > 0,
        url: `/repos/${repo.id}`,
      },
    },
    { headers: CORS }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}
