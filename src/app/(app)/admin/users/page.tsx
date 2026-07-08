import { desc, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  adjustCredits,
  setEligibilityOverride,
  toggleAdmin,
} from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function EligibilityBadge({
  u,
}: {
  u: { mintEligible: boolean; eligibilityOverride: string | null };
}) {
  if (u.eligibilityOverride === "allowed")
    return <Badge className="bg-green-600">allowed (override)</Badge>;
  if (u.eligibilityOverride === "blocked")
    return <Badge variant="destructive">blocked (override)</Badge>;
  return (
    <Badge variant={u.mintEligible ? "default" : "outline"}>
      {u.mintEligible ? "eligible" : "ineligible"}
    </Badge>
  );
}

function OverrideButtons({ userId, current }: { userId: string; current: string | null }) {
  return (
    <div className="flex gap-1">
      {current !== "allowed" && (
        <form
          action={async () => {
            "use server";
            await setEligibilityOverride(userId, "allowed");
          }}
        >
          <Button variant="outline" size="sm" type="submit">
            Allow
          </Button>
        </form>
      )}
      {current !== "blocked" && (
        <form
          action={async () => {
            "use server";
            await setEligibilityOverride(userId, "blocked");
          }}
        >
          <Button variant="outline" size="sm" type="submit" className="text-destructive">
            Restrict
          </Button>
        </form>
      )}
      {current !== null && (
        <form
          action={async () => {
            "use server";
            await setEligibilityOverride(userId, null);
          }}
        >
          <Button variant="ghost" size="sm" type="submit">
            Auto
          </Button>
        </form>
      )}
    </div>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [rows, youngAccounts] = await Promise.all([
    db
      .select()
      .from(users)
      .where(q ? ilike(users.githubLogin, `%${q}%`) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(100),
    db
      .select({
        user: users,
        ageDays: sql<number>`extract(day from now() - ${users.githubCreatedAt})::int`,
      })
      .from(users)
      .where(sql`${users.githubCreatedAt} > now() - interval '30 days'`)
      .orderBy(desc(users.githubCreatedAt))
      .limit(100),
  ]);

  return (
    <div className="space-y-6">
      {youngAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Young accounts — GitHub age under 30 days ({youngAccounts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>GitHub age</TableHead>
                  <TableHead>Repos / Followers</TableHead>
                  <TableHead>Benefits</TableHead>
                  <TableHead>Control</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {youngAccounts.map(({ user: u, ageDays }) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.githubLogin}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {ageDays != null ? `${ageDays}d` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.githubPublicRepos ?? 0} / {u.githubFollowers ?? 0}
                    </TableCell>
                    <TableCell>
                      <EligibilityBadge u={u} />
                    </TableCell>
                    <TableCell>
                      <OverrideButtons userId={u.id} current={u.eligibilityOverride} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <form className="flex gap-2">
        <Input
          name="q"
          placeholder="Search by GitHub login"
          defaultValue={q ?? ""}
          className="w-64"
        />
        <Button variant="outline" type="submit">
          Search
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Benefits</TableHead>
            <TableHead>Eligibility</TableHead>
            <TableHead>Adjust credits</TableHead>
            <TableHead>Admin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                {u.githubLogin}
                {u.isAdmin && <Badge className="ml-2">admin</Badge>}
                {u.tokenInvalidAt && (
                  <Badge variant="outline" className="ml-2">
                    stale token
                  </Badge>
                )}
              </TableCell>
              <TableCell
                className={u.creditBalance < 0 ? "text-destructive" : undefined}
              >
                {u.creditBalance}
              </TableCell>
              <TableCell>
                <EligibilityBadge u={u} />
              </TableCell>
              <TableCell>
                <OverrideButtons userId={u.id} current={u.eligibilityOverride} />
              </TableCell>
              <TableCell>
                <form
                  action={async (fd) => {
                    "use server";
                    await adjustCredits(fd);
                  }}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="userId" value={u.id} />
                  <Input
                    name="delta"
                    type="number"
                    placeholder="±n"
                    className="h-8 w-20"
                    required
                  />
                  <Input
                    name="memo"
                    placeholder="Memo (required)"
                    className="h-8 w-44"
                    required
                  />
                  <Button variant="outline" size="sm" type="submit">
                    Apply
                  </Button>
                </form>
              </TableCell>
              <TableCell>
                <form
                  action={async () => {
                    "use server";
                    await toggleAdmin(u.id, !u.isAdmin);
                  }}
                >
                  <Button variant="outline" size="sm" type="submit">
                    {u.isAdmin ? "Revoke" : "Grant"}
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
