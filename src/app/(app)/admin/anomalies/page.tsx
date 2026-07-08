import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MutualPair = {
  user_a: string;
  user_b: string;
  a_to_b: number;
  b_to_a: number;
};

type HeavyClaimer = {
  github_login: string;
  mints_7d: number;
  revoked_total: number;
  account_age_days: number;
};

export default async function AdminAnomaliesPage() {
  // Reciprocal claiming: A claimed stars on B's listings AND B on A's.
  // Legit users show up here too — it's a review queue, not a verdict.
  const [pairsResult, heavyResult] = await Promise.all([
    db.execute(sql`
      WITH claims AS (
        SELECT sm.user_id AS claimer, r.posted_by_user_id AS poster, count(*) AS n
        FROM star_mints sm
        JOIN repos r ON r.id = sm.repo_id
        WHERE sm.user_id != r.posted_by_user_id
        GROUP BY sm.user_id, r.posted_by_user_id
      )
      SELECT
        ua.github_login AS user_a,
        ub.github_login AS user_b,
        c1.n::int AS a_to_b,
        c2.n::int AS b_to_a
      FROM claims c1
      JOIN claims c2 ON c2.claimer = c1.poster AND c2.poster = c1.claimer
      JOIN users ua ON ua.id = c1.claimer
      JOIN users ub ON ub.id = c1.poster
      WHERE c1.claimer < c1.poster
      ORDER BY (c1.n + c2.n) DESC
      LIMIT 50
    `),
    db.execute(sql`
      SELECT
        u.github_login,
        (SELECT count(*) FROM star_mints sm
          WHERE sm.user_id = u.id AND sm.minted_at > now() - interval '7 days')::int AS mints_7d,
        (SELECT count(*) FROM star_mints sm
          WHERE sm.user_id = u.id AND sm.status = 'revoked')::int AS revoked_total,
        extract(day FROM now() - u.github_created_at)::int AS account_age_days
      FROM users u
      WHERE EXISTS (
        SELECT 1 FROM star_mints sm
        WHERE sm.user_id = u.id AND sm.minted_at > now() - interval '7 days'
      )
      ORDER BY mints_7d DESC
      LIMIT 50
    `),
  ]);
  const pairs = pairsResult.rows as unknown as MutualPair[];
  const heavy = heavyResult.rows as unknown as HeavyClaimer[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Reciprocal claim pairs (possible star rings)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pairs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No mutual claim patterns found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User A</TableHead>
                  <TableHead>User B</TableHead>
                  <TableHead className="text-right">A → B claims</TableHead>
                  <TableHead className="text-right">B → A claims</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pairs.map((p) => (
                  <TableRow key={`${p.user_a}-${p.user_b}`}>
                    <TableCell>{p.user_a}</TableCell>
                    <TableCell>{p.user_b}</TableCell>
                    <TableCell className="text-right">{p.a_to_b}</TableCell>
                    <TableCell className="text-right">{p.b_to_a}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Heaviest claimers (7 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {heavy.length === 0 ? (
            <p className="text-sm text-muted-foreground">No claims this week.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Claims (7d)</TableHead>
                  <TableHead className="text-right">Revoked (all time)</TableHead>
                  <TableHead className="text-right">Account age (days)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {heavy.map((h) => (
                  <TableRow key={h.github_login}>
                    <TableCell>{h.github_login}</TableCell>
                    <TableCell className="text-right">{h.mints_7d}</TableCell>
                    <TableCell className="text-right">{h.revoked_total}</TableCell>
                    <TableCell className="text-right">
                      {h.account_age_days ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
