import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { creditEntries, repos, users } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SelfHighlightForm } from "./self-highlight-form";

const TYPE_LABELS: Record<string, string> = {
  mint: "Star claimed",
  spend_self_highlight: "Self-highlight (60 min)",
  spend_donation: "Donation (15 min)",
  revocation_clawback: "Star revoked — clawback",
  highlight_cancellation_refund: "Highlight cancelled — refund",
  credit_expiry: "Credit expired",
  admin_adjustment: "Admin adjustment",
};

export default async function WalletPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const [user, entries, ownRepos] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
    db
      .select()
      .from(creditEntries)
      .where(eq(creditEntries.userId, session.user.id))
      .orderBy(desc(creditEntries.createdAt))
      .limit(100),
    db
      .select({ id: repos.id, fullName: repos.fullName })
      .from(repos)
      .where(eq(repos.postedByUserId, session.user.id)),
  ]);
  if (!user) redirect("/");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credit balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-semibold">{user.creditBalance}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            1 credit = 1 hour highlighting your own repo, or 15 minutes donated to
            any repo. Earn credits by starring listed repos.
          </p>
          {user.creditBalance < 0 && (
            <p className="mt-2 text-sm text-destructive">
              Your balance is negative from revoked stars — new credits pay the
              debt down first.
            </p>
          )}
        </CardContent>
      </Card>

      {ownRepos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spend on self-highlight</CardTitle>
          </CardHeader>
          <CardContent>
            <SelfHighlightForm
              repos={ownRepos}
              disabled={user.creditBalance < 1}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {e.createdAt.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {TYPE_LABELS[e.type] ?? e.type}
                      {e.memo ? ` — ${e.memo}` : ""}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        e.delta > 0 ? "text-green-600" : "text-destructive"
                      }`}
                    >
                      {e.delta > 0 ? `+${e.delta}` : e.delta}
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
