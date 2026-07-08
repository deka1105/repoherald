import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { socialShares, users } from "@/db/schema";
import { approveShare, rejectShare } from "@/app/actions/admin";
import { PLATFORM_LABELS } from "@/lib/shares";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminRewardsPage() {
  const rows = await db
    .select({ share: socialShares, login: users.githubLogin })
    .from(socialShares)
    .innerJoin(users, eq(socialShares.userId, users.id))
    .orderBy(desc(socialShares.createdAt))
    .limit(200);

  const statusVariant = (s: string) =>
    s === "approved" ? "default" : s === "pending" ? "secondary" : "outline";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Approve grants +1 credit immediately. The daily check revokes the credit
        if the post disappears within 7 days of submission.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Post</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Review</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ share, login }) => (
            <TableRow key={share.id}>
              <TableCell>{login}</TableCell>
              <TableCell>{PLATFORM_LABELS[share.platform] ?? share.platform}</TableCell>
              <TableCell className="max-w-64 truncate">
                <a
                  href={share.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm hover:underline"
                >
                  {share.url}
                </a>
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {share.createdAt.toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(share.status)}>{share.status}</Badge>
              </TableCell>
              <TableCell>
                {share.status === "pending" && (
                  <div className="flex gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await approveShare(share.id);
                      }}
                    >
                      <Button size="sm" type="submit">
                        Approve (+1)
                      </Button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await rejectShare(share.id);
                      }}
                    >
                      <Button variant="outline" size="sm" type="submit">
                        Reject
                      </Button>
                    </form>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
