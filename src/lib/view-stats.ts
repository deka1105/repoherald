import { sql } from "drizzle-orm";
import { db } from "@/db";

export type ViewStats = { views: number; visitors: number };

const EMPTY: ViewStats = { views: 0, visitors: 0 };

/**
 * Visits and distinct visitors, staff traffic excluded so a maintainer
 * refreshing their own page doesn't inflate it.
 *
 * Caveat worth knowing: visitor_id is a daily-rotating hash (see
 * src/lib/analytics.ts), so "visitors" is really the sum of daily uniques —
 * the same person returning tomorrow counts twice. That's the price of
 * tracking without cookies, and it's why the UI labels these loosely.
 */
export async function getRepoViewStats(repoId: string): Promise<ViewStats> {
  const res = await db.execute(sql`
    SELECT count(*)::int AS views,
           count(DISTINCT visitor_id)::int AS visitors
    FROM analytics_events
    WHERE type = 'repo_view' AND repo_id = ${repoId} AND is_admin = false
  `);
  return (res.rows[0] as unknown as ViewStats) ?? EMPTY;
}

/** List pages are recorded as ordinary page_views keyed on their path, so
 * nothing extra had to be instrumented when lists shipped. */
export async function getListViewStats(slug: string): Promise<ViewStats> {
  const res = await db.execute(sql`
    SELECT count(*)::int AS views,
           count(DISTINCT visitor_id)::int AS visitors
    FROM analytics_events
    WHERE type = 'page_view' AND path = ${`/lists/${slug}`} AND is_admin = false
  `);
  return (res.rows[0] as unknown as ViewStats) ?? EMPTY;
}
