import { desc, ilike, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  adjustCredits,
  setEligibilityOverride,
  setUserRole,
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

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") return <Badge className="ml-2">admin</Badge>;
  if (role === "moderator")
    return (
      <Badge variant="secondary" className="ml-2">
        mod
      </Badge>
    );
  return null;
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

function RoleButtons({ userId, current }: { userId: string; current: string }) {
  const roles = ["user", "moderator", "admin"] as const;
  return (
    <div className="flex gap-1">
      {roles
        .filter((r) => r !== current)
        .map((r) => (
          <form
            key={r}
            action={async () => {
              "use server";
              await setUserRole(userId, r);
            }}
          >
            <Button variant="outline" size="sm" type="submit">
              {r === "user" ? "Demote" : r === "moderator" ? "Make mod" : "Make admin"}
            </Button>
          </form>
        ))}
    </div>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  // Layout admits moderators; the mutation columns are admin-only. The
  // actions behind them enforce this server-side too.
  const isAdmin = session?.user?.role === "admin";
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
                  {isAdmin && <TableHead>Control</TableHead>}
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
                    {isAdmin && (
                      <TableCell>
                        <OverrideButtons userId={u.id} current={u.eligibilityOverride} />
                      </TableCell>
                    )}
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
            {isAdmin && <TableHead>Eligibility</TableHead>}
            {isAdmin && <TableHead>Adjust credits</TableHead>}
            {isAdmin && <TableHead>Role</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                {u.githubLogin}
                <RoleBadge role={u.role} />
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
              {isAdmin && (
                <TableCell>
                  <OverrideButtons userId={u.id} current={u.eligibilityOverride} />
                </TableCell>
              )}
              {isAdmin && (
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
              )}
              {isAdmin && (
                <TableCell>
                  <RoleButtons userId={u.id} current={u.role} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
