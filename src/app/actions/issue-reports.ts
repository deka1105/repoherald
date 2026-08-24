"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { issueReports, repos, users } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { decryptToken } from "@/lib/crypto";
import {
  ISSUE_REPORT_CREDITS,
  ISSUE_REPORT_DAILY_CAP,
  ISSUE_REPORT_WEEKLY_CAP,
  ISSUE_VALIDATION_DAYS,
  getIssueReportUsage,
} from "@/lib/credits";
import { GithubAuthError, fetchIssue } from "@/lib/github";

export type IssueReportState = { error?: string; success?: string };

const ISSUE_URL_RE =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)/i;

export async function submitIssueReport(
  _prev: IssueReportState,
  formData: FormData
): Promise<IssueReportState> {
  const user = await requireUser();

  // Same anti-farming gate as star claims — a fresh account can't file its way
  // to credits either.
  const eligible =
    user.eligibilityOverride === "allowed" ||
    (user.eligibilityOverride !== "blocked" && user.mintEligible);
  if (!eligible) {
    return {
      error:
        "Your GitHub account doesn't meet the minimum activity requirements to earn credits yet.",
    };
  }
  if (!user.githubAccessTokenEnc || user.tokenInvalidAt) {
    return { error: "Your GitHub session is stale — please sign in again." };
  }

  const repoId = String(formData.get("repoId") ?? "");
  const rawUrl = String(formData.get("issueUrl") ?? "").trim();
  const match = ISSUE_URL_RE.exec(rawUrl);
  if (!match) {
    return {
      error: "Paste the issue link, e.g. github.com/owner/name/issues/123.",
    };
  }
  const [, urlOwner, urlRepo, numberRaw] = match;
  const issueNumber = Number(numberRaw);

  const repo = await db.query.repos.findFirst({ where: eq(repos.id, repoId) });
  if (!repo || repo.status !== "active") return { error: "This listing isn't active." };

  if (`${urlOwner}/${urlRepo}`.toLowerCase() !== repo.fullName.toLowerCase()) {
    return { error: `That issue isn't on ${repo.fullName}.` };
  }
  if (
    repo.postedByUserId === user.id ||
    repo.ownerLogin.toLowerCase() === user.githubLogin.toLowerCase()
  ) {
    return { error: "You can't earn credits for reporting issues on your own repo." };
  }

  const [{ onThisRepo }] = await db
    .select({ onThisRepo: sql<number>`count(*)::int` })
    .from(issueReports)
    .where(
      and(
        eq(issueReports.userId, user.id),
        eq(issueReports.repoId, repo.id),
        ne(issueReports.status, "rejected")
      )
    );
  if (onThisRepo >= ISSUE_REPORTS_PER_REPO) {
    return {
      error: `You've already claimed an issue report on ${repo.fullName} — one per repo.`,
    };
  }

  const usage = await getIssueReportUsage(user.id);
  if (usage.day >= ISSUE_REPORT_DAILY_CAP) {
    return {
      error: `Daily issue-report limit reached (${ISSUE_REPORT_DAILY_CAP}/day) — try again tomorrow.`,
    };
  }
  if (usage.week >= ISSUE_REPORT_WEEKLY_CAP) {
    return {
      error: `Weekly issue-report limit reached (${ISSUE_REPORT_WEEKLY_CAP}/week) — try again next week.`,
    };
  }

  let issue;
  try {
    const token = decryptToken(user.githubAccessTokenEnc);
    issue = await fetchIssue(token, repo.ownerLogin, repo.name, issueNumber);
  } catch (e) {
    if (e instanceof GithubAuthError) {
      await db
        .update(users)
        .set({ tokenInvalidAt: new Date() })
        .where(eq(users.id, user.id));
      return { error: "Your GitHub session expired — please sign in again." };
    }
    throw e;
  }

  if (!issue) return { error: "We couldn't find that issue on GitHub." };
  if (issue.isPullRequest) {
    return { error: "That link is a pull request, not an issue." };
  }
  if (issue.authorLogin.toLowerCase() !== user.githubLogin.toLowerCase()) {
    return { error: "Only the issue's author can claim credit for it." };
  }
  if (issue.createdAt < repo.createdAt) {
    return {
      error:
        "Only issues opened after the repo was listed here earn credits — this one predates the listing.",
    };
  }

  const eligibleAt = new Date(
    Date.now() + ISSUE_VALIDATION_DAYS * 24 * 60 * 60 * 1000
  );
  const [row] = await db
    .insert(issueReports)
    .values({
      repoId: repo.id,
      userId: user.id,
      githubIssueId: issue.id,
      issueNumber: issue.number,
      issueUrl: issue.htmlUrl,
      eligibleAt,
    })
    // Unique on github_issue_id: the same issue can't be submitted twice, by
    // this user or any other.
    .onConflictDoNothing()
    .returning({ id: issueReports.id });

  if (!row) return { error: "That issue has already been submitted." };

  revalidatePath(`/repos/${repo.id}`);
  revalidatePath("/wallet");
  return {
    success: `Submitted — ${ISSUE_REPORT_CREDITS} credits are pending. They land in ${ISSUE_VALIDATION_DAYS} days if the issue isn't labelled invalid or duplicate.`,
  };
}
