import { NextResponse } from "next/server";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  creditEntries,
  highlights,
  repos,
  sponsorships,
  starMints,
  users,
} from "@/db/schema";
import { decryptToken } from "@/lib/crypto";
import { clawbackMint, REVOCATION_WINDOW_DAYS } from "@/lib/credits";
import { writeAudit } from "@/lib/audit";
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
      if (e instanceof GithubRateLimitError) break;
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
 * old mints expires. Never pushes a balance below zero.
 */
async function expireCredits() {
  const rows = await db.execute(sql`
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
  `);

  for (const r of rows.rows as unknown as {
    user_id: string;
    credit_balance: number;
    old_mints: number;
    consumed: number;
  }[]) {
    const expirable = Math.min(
      r.credit_balance,
      Math.max(0, r.old_mints - r.consumed)
    );
    if (expirable <= 0) continue;
    await db.transaction(async (tx) => {
      await tx.insert(creditEntries).values({
        userId: r.user_id,
        delta: -expirable,
        type: "credit_expiry",
        memo: `${expirable} credit(s) older than ${CREDIT_TTL_MONTHS} months`,
      });
      await tx
        .update(users)
        .set({ creditBalance: sql`${users.creditBalance} - ${expirable}` })
        .where(eq(users.id, r.user_id));
      await writeAudit(tx, {
        actorType: "system",
        action: "credit.expire",
        entityType: "user",
        entityId: r.user_id,
        metadata: { expired: expirable },
      });
    });
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

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { checked, revoked } = await reverifyStars();
  await expireSponsors();
  await flipHighlightStatuses();
  await expireCredits();
  await syncRepos();

  return NextResponse.json({ ok: true, checked, revoked });
}
