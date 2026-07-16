import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { creditEntries, repos, socialShares, users } from "@/db/schema";
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
import { DeleteAccount } from "./delete-account";
import { ShareRewards } from "./share-rewards";
import { SponsorAlerts } from "./sponsor-alerts";

const TYPE_LABELS: Record<string, string> = {
  mint: "Star claimed",
  spend_self_highlight: "Self-highlight (60 min)",
  spend_donation: "Donation (15 min)",
  revocation_clawback: "Star revoked — clawback",
  highlight_cancellation_refund: "Highlight cancelled — refund",
  credit_expiry: "Credit expired",
  admin_adjustment: "Admin adjustment",
  social_share_reward: "Social share reward",
  social_share_clawback: "Share removed — clawback",
  welcome_bonus: "Welcome bonus",
  purchase: "Credits purchased",
  purchase_refund: "Purchase refunded — clawback",
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const { purchase } = await searchParams;

  const [user, entries, ownRepos, shares] = await Promise.all([
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
    db
      .select()
      .from(socialShares)
      .where(eq(socialShares.userId, session.user.id))
      .orderBy(desc(socialShares.createdAt)),
  ]);
  if (!user) redirect("/");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {purchase === "success" && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Payment received — your credits will appear below within a few seconds.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credit balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-semibold">{user.creditBalance}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            1 credit = 1 hour highlighting your own repo, or 15 minutes donated to
            any repo. Earn credits by starring listed repos, or{" "}
            <Link href="/credits" className="underline underline-offset-2">
              buy a credit pack
            </Link>
            .
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
          <CardTitle className="text-base">Rewards — share &amp; earn</CardTitle>
        </CardHeader>
        <CardContent>
          <ShareRewards shares={shares} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <SponsorAlerts
            optIn={user.sponsorAlertsOptIn}
            hasEmail={Boolean(user.email)}
          />
        </CardContent>
      </Card>

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

      <div className="flex justify-end">
        <DeleteAccount />
      </div>
    </div>
  );
}
