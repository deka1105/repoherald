import { desc, ilike } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { adjustCredits, toggleAdmin } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const rows = await db
    .select()
    .from(users)
    .where(q ? ilike(users.githubLogin, `%${q}%`) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(100);

  return (
    <div className="space-y-4">
      <form className="flex gap-2">
        <Input name="q" placeholder="Search by GitHub login" defaultValue={q ?? ""} className="w-64" />
        <Button variant="outline" type="submit">Search</Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Eligible</TableHead>
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
                  <Badge variant="outline" className="ml-2">stale token</Badge>
                )}
              </TableCell>
              <TableCell
                className={u.creditBalance < 0 ? "text-destructive" : undefined}
              >
                {u.creditBalance}
              </TableCell>
              <TableCell>{u.mintEligible ? "yes" : "no"}</TableCell>
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
