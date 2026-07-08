import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, repos, users } from "@/db/schema";
import { resolveReport, setRepoStatus } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminListingsPage() {
  const [listings, openReports] = await Promise.all([
    db
      .select({ repo: repos, posterLogin: users.githubLogin })
      .from(repos)
      .innerJoin(users, eq(repos.postedByUserId, users.id))
      .orderBy(desc(repos.createdAt))
      .limit(200),
    db
      .select({ report: reports, repoName: repos.fullName })
      .from(reports)
      .innerJoin(repos, eq(reports.repoId, repos.id))
      .where(eq(reports.status, "open"))
      .orderBy(desc(reports.createdAt)),
  ]);

  return (
    <div className="space-y-6">
      {openReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Open reports ({openReports.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openReports.map(({ report, repoName }) => (
              <div
                key={report.id}
                className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm"
              >
                <span>
                  <span className="font-medium">{repoName}</span> — {report.reason}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await resolveReport(report.id);
                  }}
                >
                  <Button variant="outline" size="sm" type="submit">
                    Resolve
                  </Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Repo</TableHead>
            <TableHead>Posted by</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listings.map(({ repo, posterLogin }) => (
            <TableRow key={repo.id}>
              <TableCell>
                <Link href={`/repos/${repo.id}`} className="hover:underline">
                  {repo.fullName}
                </Link>
              </TableCell>
              <TableCell>{posterLogin}</TableCell>
              <TableCell>
                <Badge variant={repo.status === "active" ? "default" : "outline"}>
                  {repo.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {repo.status !== "active" && (
                    <form
                      action={async () => {
                        "use server";
                        await setRepoStatus(repo.id, "active");
                      }}
                    >
                      <Button variant="outline" size="sm">Restore</Button>
                    </form>
                  )}
                  {repo.status === "active" && (
                    <form
                      action={async () => {
                        "use server";
                        await setRepoStatus(repo.id, "hidden");
                      }}
                    >
                      <Button variant="outline" size="sm">Hide</Button>
                    </form>
                  )}
                  {repo.status !== "removed" && (
                    <form
                      action={async () => {
                        "use server";
                        await setRepoStatus(repo.id, "removed");
                      }}
                    >
                      <Button variant="destructive" size="sm">Remove</Button>
                    </form>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
