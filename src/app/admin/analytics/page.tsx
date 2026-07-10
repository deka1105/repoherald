import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Analytics — repoherald admin" };

type Totals = {
  views_24h: number;
  views_7d: number;
  views_30d: number;
  visitors_24h: number;
  visitors_7d: number;
  visitors_30d: number;
};
type TrendRow = { day: string; views: number; visitors: number };
type PostRow = {
  id: string;
  full_name: string;
  opens: number;
  uniques: number;
  claim_clicks: number;
  donate_clicks: number;
};
type PageRow = { path: string; views: number; visitors: number };
type SourceRow = { referrer_host: string; visitors: number };
type Funnel = {
  repo_views: number;
  claim_clicks: number;
  stars_claimed: number;
  highlights_spent: number;
};

function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export default async function AdminAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!session.user.isAdmin) redirect("/");

  const [totalsR, trendR, postsR, pagesR, sourcesR, funnelR] = await Promise.all([
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS views_24h,
        count(*) FILTER (WHERE created_at > now() - interval '7 days')::int  AS views_7d,
        count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS views_30d,
        count(DISTINCT visitor_id) FILTER (WHERE created_at > now() - interval '24 hours')::int AS visitors_24h,
        count(DISTINCT visitor_id) FILTER (WHERE created_at > now() - interval '7 days')::int  AS visitors_7d,
        count(DISTINCT visitor_id) FILTER (WHERE created_at > now() - interval '30 days')::int AS visitors_30d
      FROM analytics_events
      WHERE is_admin = false AND type IN ('page_view','repo_view')
    `),
    db.execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             count(*)::int AS views,
             count(DISTINCT visitor_id)::int AS visitors
      FROM analytics_events
      WHERE is_admin = false AND type IN ('page_view','repo_view')
        AND created_at > now() - interval '14 days'
      GROUP BY 1 ORDER BY 1
    `),
    db.execute(sql`
      SELECT r.id, r.full_name,
        count(*) FILTER (WHERE e.type='repo_view')::int AS opens,
        count(DISTINCT e.visitor_id) FILTER (WHERE e.type='repo_view')::int AS uniques,
        count(*) FILTER (WHERE e.type='claim_click')::int AS claim_clicks,
        count(*) FILTER (WHERE e.type='donate_click')::int AS donate_clicks
      FROM analytics_events e
      JOIN repos r ON r.id = e.repo_id
      WHERE e.is_admin = false AND e.repo_id IS NOT NULL
        AND e.created_at > now() - interval '30 days'
      GROUP BY r.id, r.full_name
      ORDER BY opens DESC
      LIMIT 15
    `),
    db.execute(sql`
      SELECT path, count(*)::int AS views, count(DISTINCT visitor_id)::int AS visitors
      FROM analytics_events
      WHERE is_admin = false AND type = 'page_view' AND path IS NOT NULL
        AND created_at > now() - interval '30 days'
      GROUP BY path ORDER BY views DESC LIMIT 15
    `),
    db.execute(sql`
      SELECT referrer_host, count(DISTINCT visitor_id)::int AS visitors
      FROM analytics_events
      WHERE is_admin = false AND referrer_host IS NOT NULL
        AND created_at > now() - interval '30 days'
      GROUP BY referrer_host ORDER BY visitors DESC LIMIT 10
    `),
    db.execute(sql`
      SELECT
        (SELECT count(*) FROM analytics_events WHERE type='repo_view'   AND is_admin=false AND created_at > now() - interval '30 days')::int AS repo_views,
        (SELECT count(*) FROM analytics_events WHERE type='claim_click' AND is_admin=false AND created_at > now() - interval '30 days')::int AS claim_clicks,
        (SELECT count(*) FROM credit_entries  WHERE type='mint' AND created_at > now() - interval '30 days')::int AS stars_claimed,
        (SELECT count(*) FROM credit_entries  WHERE type IN ('spend_self_highlight','spend_donation') AND created_at > now() - interval '30 days')::int AS highlights_spent
    `),
  ]);

  const totals = (totalsR.rows[0] as unknown as Totals) ?? {
    views_24h: 0, views_7d: 0, views_30d: 0,
    visitors_24h: 0, visitors_7d: 0, visitors_30d: 0,
  };
  const trend = trendR.rows as unknown as TrendRow[];
  const posts = postsR.rows as unknown as PostRow[];
  const pages = pagesR.rows as unknown as PageRow[];
  const sources = sourcesR.rows as unknown as SourceRow[];
  const funnel = (funnelR.rows[0] as unknown as Funnel) ?? {
    repo_views: 0, claim_clicks: 0, stars_claimed: 0, highlights_spent: 0,
  };

  const maxTrend = Math.max(1, ...trend.map((t) => t.views));
  const totalEvents = totals.views_30d;

  const cards: [string, number, string][] = [
    ["Visitors (24h)", totals.visitors_24h, `${totals.views_24h} views`],
    ["Visitors (7d)", totals.visitors_7d, `${totals.views_7d} views`],
    ["Visitors (30d)", totals.visitors_30d, `${totals.views_30d} views`],
  ];

  const funnelStages: [string, number][] = [
    ["Repo opens", funnel.repo_views],
    ["Claim clicks", funnel.claim_clicks],
    ["Stars claimed", funnel.stars_claimed],
    ["Highlights spent", funnel.highlights_spent],
  ];
  const funnelMax = Math.max(1, ...funnelStages.map(([, v]) => v));

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 pb-24 md:pb-14">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Analytics</h1>
          <Link href="/admin" className="text-sm text-muted-foreground hover:underline">
            ← Back to admin
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          First-party, cookieless. Excludes signed-in admin traffic.
        </p>

        {totalEvents === 0 && (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No analytics collected yet — data appears as visitors browse the site.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map(([label, value, sub]) => (
            <Card key={label}>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Views — last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="flex h-32 items-end gap-1">
                {trend.map((t) => (
                  <div key={t.day} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-primary/70"
                      style={{ height: `${(t.views / maxTrend) * 100}%` }}
                      title={`${t.day}: ${t.views} views, ${t.visitors} visitors`}
                    />
                    <span className="text-[9px] text-muted-foreground">
                      {t.day.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion — last 30 days</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {funnelStages.map(([label, value], i) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-sm">{label}</span>
                <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary/70"
                    style={{ width: `${(value / funnelMax) * 100}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-sm tabular-nums">
                  {value.toLocaleString()}
                  {i > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      ({pct(value, funnelStages[i - 1][1])})
                    </span>
                  )}
                </span>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              Aggregate rates between stages (not per-visitor cohorts).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top posts (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No post opens yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repo</TableHead>
                    <TableHead className="text-right">Opens</TableHead>
                    <TableHead className="text-right">Uniques</TableHead>
                    <TableHead className="text-right">Claim CTR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/repos/${p.id}`} className="hover:underline">
                          {p.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.opens}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.uniques}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pct(p.claim_clicks, p.opens)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top pages (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              {pages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Path</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Visitors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pages.map((p) => (
                      <TableRow key={p.path}>
                        <TableCell className="max-w-[220px] truncate font-mono text-xs">
                          {p.path}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.views}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.visitors}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Traffic sources (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              {sources.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No external referrers yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referrer</TableHead>
                      <TableHead className="text-right">Visitors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources.map((s) => (
                      <TableRow key={s.referrer_host}>
                        <TableCell className="truncate">{s.referrer_host}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {s.visitors}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
