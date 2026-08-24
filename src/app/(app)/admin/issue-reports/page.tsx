import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { issueReports, repos, users } from "@/db/schema";
import {
  rejectIssueReportAsStaff,
  validateIssueReportNow,
} from "@/app/actions/issue-reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ISSUE_REPORT_CREDITS, ISSUE_VALIDATION_DAYS } from "@/lib/credits";
import { timeAgo } from "@/lib/utils";

// The reward queue. "Validate now" runs exactly what the nightly cron would,
// which is the only way to exercise the payout without waiting out the window.
export default async function AdminIssueReportsPage() {
  const rows = await db
    .select({
      report: issueReports,
      reporterLogin: users.githubLogin,
      repoName: repos.fullName,
    })
    .from(issueReports)
    .innerJoin(users, eq(issueReports.userId, users.id))
    .innerJoin(repos, eq(issueReports.repoId, repos.id))
    .orderBy(desc(issueReports.createdAt))
    .limit(200);

  const pending = rows.filter((r) => r.report.status === "pending").length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {pending} pending ·{" "}
        {(pending * ISSUE_REPORT_CREDITS).toLocaleString()} credits held. Reports
        settle automatically {ISSUE_VALIDATION_DAYS} days after submission unless
        the issue is labelled invalid, duplicate, spam, wontfix, or not planned.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No issue reports yet.</p>
      ) : (
        rows.map(({ report, reporterLogin, repoName }) => (
          <div
            key={report.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3"
          >
            <div className="min-w-0">
              <p className="text-sm">
                <span className="font-medium">@{reporterLogin}</span>{" "}
                <span className="text-muted-foreground">on</span>{" "}
                <Link href={`/repos/${report.repoId}`} className="hover:underline">
                  {repoName}
                </Link>{" "}
                <a
                  href={report.issueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  #{report.issueNumber}
                </a>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                submitted {timeAgo(report.createdAt)} · clears{" "}
                {report.eligibleAt.toLocaleDateString()}
                {report.rejectedReason ? ` · ${report.rejectedReason}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge
                variant={
                  report.status === "approved"
                    ? "default"
                    : report.status === "rejected"
                      ? "outline"
                      : "secondary"
                }
              >
                {report.status}
              </Badge>
              {report.status === "pending" && (
                <>
                  <form
                    action={async () => {
                      "use server";
                      await validateIssueReportNow(report.id);
                    }}
                  >
                    <Button type="submit" size="sm">
                      Validate now
                    </Button>
                  </form>
                  <form action={rejectIssueReportAsStaff}>
                    <input type="hidden" name="reportId" value={report.id} />
                    <Button type="submit" size="sm" variant="destructive">
                      Reject
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
