import { NextResponse } from "next/server";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  highlights,
  issueReports,
  repos,
  socialShares,
  sponsorships,
  starMints,
  users,
} from "@/db/schema";
import { decryptToken } from "@/lib/crypto";
import {
  clawbackMint,
  clawbackShareReward,
  REVOCATION_WINDOW_DAYS,
} from "@/lib/credits";
import { validateOneIssueReport } from "@/lib/issue-validation";
import { isCronAuthorized } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { log } from "@/lib/log";
import { refundSponsorshipForRepo } from "@/lib/stripe";
import {
  GithubAuthError,
  GithubRateLimitError,
  fetchRepoById,
  fetchRepoLanguages,
  isStarred,
} from "@/lib/github";

export const maxDuration = 300;

// Hobby-plan crons run once daily, so each run covers a full day's worth.
const BATCH_LIMIT = 1000;
const REPO_SYNC_LIMIT = 50;
const CREDIT_TTL_MONTHS = 12;

async function freezeRepo(repoId: string, reason: string) {
  await db
    .update(repos)
    .set({ status: "removed", removedReason: reason })
    .where(eq(repos.id, repoId));
  await db
    .update(starMints)
    .set({ status: "frozen" })
    .where(and(eq(starMints.repoId, repoId), eq(starMints.status, "minted")));
  await refundSponsorshipForRepo(repoId);
  await writeAudit(db, {
    actorType: "system",
    action: "listing.remove",
    entityType: "repo",
    entityId: repoId,
    metadata: { reason },
  });
}

async function reverifyStars(): Promise<{ checked: number; revoked: number }> {
  const batch = await db
    .select({
      mint: starMints,
      repo: repos,
      user: users,
    })
    .from(starMints)
    .innerJoin(repos, eq(starMints.repoId, repos.id))
    .innerJoin(users, eq(starMints.userId, users.id))
    .where(
      and(
        eq(starMints.status, "minted"),
        gt(
          starMints.mintedAt,
          sql`now() - interval '${sql.raw(String(REVOCATION_WINDOW_DAYS))} days'`
        ),
        or(
          isNull(starMints.lastVerifiedAt),
          lt(starMints.lastVerifiedAt, sql`now() - interval '24 hours'`)
        ),
        isNull(users.tokenInvalidAt)
      )
    )
    .orderBy(sql`${starMints.lastVerifiedAt} ASC NULLS FIRST`)
    .limit(BATCH_LIMIT);

  const byUser = new Map<string, typeof batch>();
  for (const row of batch) {
    byUser.set(row.user.id, [...(byUser.get(row.user.id) ?? []), row]);
  }

  let checked = 0;
  let revoked = 0;

  for (const [userId, rows] of byUser) {
    const tokenEnc = rows[0].user.githubAccessTokenEnc;
    if (!tokenEnc) continue;
    let token: string;
    try {
      token = decryptToken(tokenEnc);
    } catch {
      continue;
    }

    try {
      for (const { mint, repo } of rows) {
        let starred: boolean;
        let ownerLogin = repo.ownerLogin;
        let repoName = repo.name;

        starred = await isStarred(token, ownerLogin, repoName);
        if (!starred) {
          // 404 is ambiguous: unstarred, or the repo moved/was deleted.
          const ghRepo = await fetchRepoById(token, repo.githubRepoId);
          if (!ghRepo) {
            await freezeRepo(repo.id, "repo_deleted_or_private");
            continue;
          }
          if (ghRepo.full_name !== repo.fullName) {
            await db
              .update(repos)
              .set({
                fullName: ghRepo.full_name,
                ownerLogin: ghRepo.owner.login,
                name: ghRepo.name,
              })
              .where(eq(repos.id, repo.id));
            ownerLogin = ghRepo.owner.login;
            repoName = ghRepo.name;
            starred = await isStarred(token, ownerLogin, repoName);
          }
        }

        checked++;
        if (starred) {
          await db
            .update(starMints)
            .set({ lastVerifiedAt: new Date() })
            .where(eq(starMints.id, mint.id));
        } else {
          await clawbackMint(mint.id);
          revoked++;
        }
      }
    } catch (e) {
      if (e instanceof GithubAuthError) {
        // Absence of proof isn't proof of unstar: block new mints, never revoke.
        await db
          .update(users)
          .set({ tokenInvalidAt: new Date() })
          .where(eq(users.id, userId));
        continue;
      }
      // Rate limits are per user token: skip this user's remaining mints
      // (lastVerifiedAt is untouched, so the next run picks them up) and
      // keep verifying everyone else.
      if (e instanceof GithubRateLimitError) continue;
      throw e;
    }
  }
  return { checked, revoked };
}

async function expireSponsors() {
  await db
    .update(sponsorships)
    .set({ status: "expired" })
    .where(
      and(eq(sponsorships.status, "active"), lt(sponsorships.endsAt, sql`now()`))
    );
  // "N days or M stars, whichever first": expire once the repo has gained
  // stars_cap stars since activation (stars refresh in the daily sync).
  await db.execute(sql`
    UPDATE sponsorships s
    SET status = 'expired', ends_at = now()
    FROM repos r
    WHERE r.id = s.repo_id
      AND s.status = 'active'
      AND s.stars_cap IS NOT NULL
      AND r.stars_count - coalesce(s.stars_at_start, 0) >= s.stars_cap
  `);
}

async function flipHighlightStatuses() {
  // Reporting-only flips; live placement always derives from timestamps.
  await db
    .update(highlights)
    .set({ status: "active" })
    .where(
      and(
        eq(highlights.status, "scheduled"),
        sql`${highlights.startsAt} <= now()`,
        gt(highlights.endsAt, sql`now()`)
      )
    );
  await db
    .update(highlights)
    .set({ status: "completed" })
    .where(
      and(
        sql`${highlights.status} IN ('scheduled', 'active')`,
        sql`${highlights.endsAt} <= now()`
      )
    );
}

/**
 * Expire credits from mints older than 12 months, FIFO: spends are treated
 * as consuming the oldest mints first, so only the unconsumed surplus of
 * old mints expires. Never pushes a balance below zero. One set-based
 * statement (ledger entry, balance debit, and audit row per user) — a
 * per-user transaction loop would outgrow the cron's 300s window.
 */
async function expireCredits() {
  await db.execute(sql`
    WITH usage AS (
      SELECT
        u.id AS user_id,
        u.credit_balance,
        (SELECT count(*) FROM credit_entries e
          WHERE e.user_id = u.id AND e.type = 'mint'
            AND e.created_at < now() - interval '${sql.raw(String(CREDIT_TTL_MONTHS))} months'
            AND NOT EXISTS (
              SELECT 1 FROM credit_entries cb
              WHERE cb.star_mint_id = e.star_mint_id
                AND cb.type = 'revocation_clawback'
            )
        )::int AS old_mints,
        (SELECT coalesce(sum(-e.delta), 0) FROM credit_entries e
          WHERE e.user_id = u.id
            AND e.type IN ('spend_self_highlight', 'spend_donation', 'credit_expiry')
        )::int
        - (SELECT count(*) FROM credit_entries e
          WHERE e.user_id = u.id AND e.type = 'highlight_cancellation_refund'
        )::int AS consumed
      FROM users u
      WHERE u.credit_balance > 0
    ),
    candidates AS (
      SELECT user_id,
        least(credit_balance, greatest(0, old_mints - consumed)) AS expirable
      FROM usage
      WHERE least(credit_balance, greatest(0, old_mints - consumed)) > 0
    ),
    expired AS (
      INSERT INTO credit_entries (user_id, delta, type, memo)
      SELECT user_id, -expirable, 'credit_expiry',
        expirable || ' credit(s) older than ${sql.raw(String(CREDIT_TTL_MONTHS))} months'
      FROM candidates
      RETURNING user_id, -delta AS expired
    ),
    debited AS (
      UPDATE users u
      SET credit_balance = u.credit_balance - e.expired
      FROM expired e
      WHERE u.id = e.user_id
      RETURNING u.id AS user_id, e.expired
    )
    INSERT INTO audit_log (actor_type, action, entity_type, entity_id, metadata)
    SELECT 'system', 'credit.expire', 'user', user_id::text,
      jsonb_build_object('expired', expired)
    FROM debited
  `);
}

/**
 * Liveness check for social-share posts within their 7-day window. Only an
 * explicit 404/410 counts as "gone" — social platforms often gate bots behind
 * logins or 403s, and absence of proof isn't proof of deletion.
 */
async function checkSocialShares() {
  const window = await db
    .select()
    .from(socialShares)
    .where(
      and(
        sql`${socialShares.status} IN ('pending', 'approved')`,
        gt(socialShares.createdAt, sql`now() - interval '7 days'`),
        or(
          isNull(socialShares.lastCheckedAt),
          lt(socialShares.lastCheckedAt, sql`now() - interval '20 hours'`)
        )
      )
    )
    .limit(100);

  for (const share of window) {
    let gone = false;
    try {
      const res = await fetch(share.url, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; repoherald-check)" },
        signal: AbortSignal.timeout(10_000),
      });
      gone = res.status === 404 || res.status === 410;
    } catch {
      // Network hiccup — treat as alive; we'll check again tomorrow.
    }

    if (gone) {
      if (share.status === "approved") {
        await clawbackShareReward(share.id, "post_removed_within_7_days");
      } else {
        await db
          .update(socialShares)
          .set({ status: "rejected" })
          .where(eq(socialShares.id, share.id));
      }
    } else {
      await db
        .update(socialShares)
        .set({ lastCheckedAt: new Date() })
        .where(eq(socialShares.id, share.id));
    }
  }
}

async function syncRepos() {
  const stale = await db
    .select({ repo: repos, user: users })
    .from(repos)
    .innerJoin(users, eq(repos.postedByUserId, users.id))
    .where(
      and(
        eq(repos.status, "active"),
        or(
          isNull(repos.lastSyncedAt),
          lt(repos.lastSyncedAt, sql`now() - interval '24 hours'`)
        ),
        isNull(users.tokenInvalidAt)
      )
    )
    .limit(REPO_SYNC_LIMIT);

  for (const { repo, user } of stale) {
    if (!user.githubAccessTokenEnc) continue;
    try {
      const token = decryptToken(user.githubAccessTokenEnc);
      const ghRepo = await fetchRepoById(token, repo.githubRepoId);
      if (!ghRepo) {
        await freezeRepo(repo.id, "repo_deleted_or_private");
        continue;
      }
      const languages = await fetchRepoLanguages(
        token,
        ghRepo.owner.login,
        ghRepo.name
      );
      await db
        .update(repos)
        .set({
          fullName: ghRepo.full_name,
          ownerLogin: ghRepo.owner.login,
          name: ghRepo.name,
          description: ghRepo.description,
          primaryLanguage: ghRepo.language,
          languages,
          starsCount: ghRepo.stargazers_count,
          isArchived: ghRepo.archived,
          avatarUrl: ghRepo.owner.avatar_url,
          lastSyncedAt: new Date(),
        })
        .where(eq(repos.id, repo.id));
    } catch (e) {
      if (e instanceof GithubAuthError) {
        await db
          .update(users)
          .set({ tokenInvalidAt: new Date() })
          .where(eq(users.id, user.id));
        continue;
      }
      if (e instanceof GithubRateLimitError) break;
      throw e;
    }
  }
}

/**
 * Settle issue reports whose 7-day window has elapsed: pay out unless the
 * issue picked up a dismissive label (invalid/duplicate/…) or disappeared.
 * A GitHub failure leaves the row pending for the next run — absence of proof
 * is not proof of a bad report, the same rule star reverification follows.
 */
async function validateIssueReports(): Promise<{ paid: number; rejected: number }> {
  const batch = await db
    .select({ report: issueReports, repo: repos, user: users })
    .from(issueReports)
    .innerJoin(repos, eq(issueReports.repoId, repos.id))
    .innerJoin(users, eq(issueReports.userId, users.id))
    .where(
      and(
        eq(issueReports.status, "pending"),
        lt(issueReports.eligibleAt, sql`now()`)
      )
    )
    .orderBy(sql`${issueReports.eligibleAt} ASC`)
    .limit(BATCH_LIMIT);

  let paid = 0;
  let rejected = 0;

  for (const { report, repo, user } of batch) {
    try {
      // Token handling and the reject/pay rules live in validateOneIssueReport,
      // shared with the staff "validate now" button so they can't drift.
      const outcome = await validateOneIssueReport({ report, repo, user });
      if (outcome === "paid") paid++;
      if (outcome === "rejected") rejected++;
    } catch (e) {
      if (e instanceof GithubAuthError) {
        await db
          .update(users)
          .set({ tokenInvalidAt: new Date() })
          .where(eq(users.id, user.id));
        continue;
      }
      if (e instanceof GithubRateLimitError) break;
      throw e;
    }
  }

  return { paid, rejected };
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { checked, revoked } = await reverifyStars();
    await expireSponsors();
    await flipHighlightStatuses();
    await expireCredits();
    await syncRepos();
    await checkSocialShares();
    const issues = await validateIssueReports();
    log.info("cron.reverify", { checked, revoked, issues });
    return NextResponse.json({ ok: true, checked, revoked, issues });
  } catch (e) {
    log.error("cron.reverify.failed", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
