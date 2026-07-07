import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminDashboard() {
  const [stats] = (
    await db.execute(sql`
      SELECT
        (SELECT count(*) FROM repos WHERE status = 'active')::int AS active_repos,
        (SELECT count(*) FROM users)::int AS total_users,
        (SELECT count(*) FROM sponsorships WHERE status = 'active' AND ends_at > now())::int AS active_sponsorships,
        (SELECT count(*) FROM highlights WHERE status != 'cancelled' AND starts_at <= now() AND ends_at > now())::int AS active_highlights,
        (SELECT count(*) FROM credit_entries WHERE type = 'mint' AND created_at > now() - interval '24 hours')::int AS mints_24h,
        (SELECT count(*) FROM star_mints WHERE status = 'revoked' AND revoked_at > now() - interval '7 days')::int AS revocations_7d,
        (SELECT count(*) FROM reports WHERE status = 'open')::int AS open_reports
    `)
  ).rows as unknown as Record<string, number>[];

  const cards = [
    ["Active listings", stats.active_repos],
    ["Users", stats.total_users],
    ["Active sponsorships", stats.active_sponsorships],
    ["Live highlights", stats.active_highlights],
    ["Claims (24h)", stats.mints_24h],
    ["Revocations (7d)", stats.revocations_7d],
    ["Open reports", stats.open_reports],
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map(([label, value]) => (
        <Card key={label}>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              {label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
