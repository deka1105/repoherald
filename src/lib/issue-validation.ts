import "server-only";
import { fetchIssue } from "@/lib/github";
import {
  grantIssueReportReward,
  hasDismissiveLabel,
  rejectIssueReport,
} from "@/lib/credits";
import type { issueReports, repos, users } from "@/db/schema";

export type ValidationOutcome = "paid" | "rejected" | "skipped";

type Row = {
  report: typeof issueReports.$inferSelect;
  repo: typeof repos.$inferSelect;
  user: typeof users.$inferSelect;
};

/**
 * Decide one pending report: pay it, reject it, or leave it alone.
 *
 * Shared by the nightly cron and the staff "validate now" button so the two can
 * never drift apart. Deliberately does NOT check eligible_at — the cron filters
 * on that in SQL, and staff validation is meant to run before the window ends.
 *
 * GithubAuthError / GithubRateLimitError propagate: the caller decides whether
 * to mark the token invalid or stop the batch. A report is never rejected
 * because GitHub was unreachable.
 */
export async function validateOneIssueReport(row: Row): Promise<ValidationOutcome> {
  const { report, repo, user } = row;
  if (report.status !== "pending") return "skipped";
  let token: string;
  try {
    const resolved = await getGithubToken(user.id);
    if (!resolved) return "skipped";
    token = resolved;
  } catch {
    return "skipped";
  }

  const issue = await fetchIssue(
    token,
    repo.ownerLogin,
    repo.name,
    report.issueNumber
  );
  if (!issue) {
    await rejectIssueReport(report.id, "issue_deleted");
    return "rejected";
  }

  const bad = hasDismissiveLabel(issue.labels);
  if (bad) {
    await rejectIssueReport(report.id, `labelled_${bad.toLowerCase()}`);
    return "rejected";
  }

  return (await grantIssueReportReward(report.id)) ? "paid" : "skipped";
}
