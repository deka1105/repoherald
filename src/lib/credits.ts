import { and, desc, eq, gt, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  creditEntries,
  highlights,
  repos,
  socialShares,
  starMints,
  users,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { log } from "@/lib/log";
import type { Tx } from "@/db";

export const DAILY_MINT_CAP = 6;
export const WEEKLY_MINT_CAP = 20;
export const CLAIMS_PER_MINUTE = 5;
export const SELF_HIGHLIGHT_MINUTES = 60;
export const DONATION_MINUTES = 15;
export const MAX_QUEUED_MINUTES_PER_REPO = 24 * 60;
export const REVOCATION_WINDOW_DAYS = 100;
export const WELCOME_BONUS_CREDITS = 10;

export class CreditError extends Error {}

/**
 * Grant the one-time signup bonus to a newly created user. Idempotent: the
 * partial unique index on (user_id) WHERE type='welcome_bonus' makes a second
 * grant impossible even if two sign-ins race. Returns false when already granted.
 */
export async function grantWelcomeCredit(userId: string) {
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const [entry] = await tx
      .insert(creditEntries)
      .values({
        userId,
        delta: WELCOME_BONUS_CREDITS,
        type: "welcome_bonus",
        memo: "Welcome bonus",
      })
      .onConflictDoNothing()
      .returning({ id: creditEntries.id });
    if (!entry) return false;

    await tx
      .update(users)
      .set({ creditBalance: sql`${users.creditBalance} + ${WELCOME_BONUS_CREDITS}` })
      .where(eq(users.id, userId));
    await writeAudit(tx, {
      actorUserId: userId,
      actorType: "system",
      action: "credit.welcome_bonus",
      entityType: "user",
      entityId: userId,
      metadata: { credits: WELCOME_BONUS_CREDITS },
    });
    log.info("credit.welcome_bonus", { userId, credits: WELCOME_BONUS_CREDITS });
    return true;
  });
}

/**
 * Claims used in the current UTC day and ISO week (Monday start), counted
 * from mint ledger entries — the same numbers mintCredit enforces against.
 */
export async function getClaimUsage(userId: string, tx: Tx | typeof db = db) {
  const [row] = await tx
    .select({
      day: sql<number>`count(*) FILTER (WHERE ${creditEntries.createdAt} >= date_trunc('day', now()))::int`,
      week: sql<number>`count(*)::int`,
    })
    .from(creditEntries)
    .where(
      and(
        eq(creditEntries.userId, userId),
        eq(creditEntries.type, "mint"),
        gte(creditEntries.createdAt, sql`date_trunc('week', now())`)
      )
    );
  return { day: row.day, week: row.week };
}

async function lockUser(tx: Tx, userId: string) {
  const [user] = await tx
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .for("update");
  if (!user) throw new CreditError("User not found");
  return user;
}

async function applyDelta(
  tx: Tx,
  userId: string,
  entry: {
    delta: number;
    type: (typeof creditEntries.$inferInsert)["type"];
    starMintId?: string;
    highlightId?: string;
    adminUserId?: string;
    memo?: string;
  }
) {
  const [row] = await tx
    .insert(creditEntries)
    .values({ userId, ...entry })
    .returning({ id: creditEntries.id });
  await tx
    .update(users)
    .set({ creditBalance: sql`${users.creditBalance} + ${entry.delta}` })
    .where(eq(users.id, userId));
  return row.id;
}

/**
 * Mint a credit for a verified star. Star verification (exists + postdates
 * the listing) must happen BEFORE calling this; this handles the ledger side
 * atomically. Returns null when the (user, repo) pair already minted.
 */
export async function mintCredit(userId: string, repoId: string, githubRepoId: number) {
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);

    const usage = await getClaimUsage(userId, tx);
    if (usage.day >= DAILY_MINT_CAP) {
      throw new CreditError(
        `Daily claim limit reached (${DAILY_MINT_CAP}/day) — try again tomorrow.`
      );
    }
    if (usage.week >= WEEKLY_MINT_CAP) {
      throw new CreditError(
        `Weekly claim limit reached (${WEEKLY_MINT_CAP}/week) — try again next week.`
      );
    }

    const [{ recent }] = await tx
      .select({ recent: sql<number>`count(*)::int` })
      .from(creditEntries)
      .where(
        and(
          eq(creditEntries.userId, userId),
          eq(creditEntries.type, "mint"),
          gt(creditEntries.createdAt, sql`now() - interval '1 minute'`)
        )
      );
    if (recent >= CLAIMS_PER_MINUTE) {
      throw new CreditError("Too many claims at once — slow down a little.");
    }

    const [mint] = await tx
      .insert(starMints)
      .values({ userId, repoId, githubRepoId })
      .onConflictDoNothing({ target: [starMints.userId, starMints.repoId] })
      .returning({ id: starMints.id });
    if (!mint) return null; // already claimed once, ever — including revoked

    await applyDelta(tx, userId, { delta: 1, type: "mint", starMintId: mint.id });
    await writeAudit(tx, {
      actorUserId: userId,
      actorType: "user",
      action: "credit.mint",
      entityType: "star_mint",
      entityId: mint.id,
      metadata: { repoId },
    });
    log.info("credit.mint", { userId, repoId, mintId: mint.id });
    return mint.id;
  });
}

/**
 * Spend one credit on highlight time: 60 min on your own listing, or a
 * 15-min donation to any listing. Queues behind the repo's existing
 * highlight time (no overlap), capped at 24h queued per repo.
 */
export async function spendCredit(
  userId: string,
  repoId: string,
  kind: "self" | "donation"
) {
  return db.transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (user.creditBalance < 1) {
      throw new CreditError("No credits available.");
    }

    const [repo] = await tx.select().from(repos).where(eq(repos.id, repoId));
    if (!repo || repo.status !== "active") {
      throw new CreditError("This listing isn't active.");
    }
    if (kind === "self" && repo.postedByUserId !== userId) {
      throw new CreditError("Self-highlight is only for repos you posted.");
    }

    const minutes = kind === "self" ? SELF_HIGHLIGHT_MINUTES : DONATION_MINUTES;

    const [{ queueEnd, queuedMinutes }] = await tx
      .select({
        queueEnd: sql<string | null>`max(${highlights.endsAt})`,
        queuedMinutes: sql<number>`coalesce(sum(extract(epoch from (${highlights.endsAt} - greatest(${highlights.startsAt}, now()))) / 60), 0)::int`,
      })
      .from(highlights)
      .where(
        and(
          eq(highlights.repoId, repoId),
          sql`${highlights.status} != 'cancelled'`,
          gt(highlights.endsAt, sql`now()`)
        )
      );
    if (queuedMinutes + minutes > MAX_QUEUED_MINUTES_PER_REPO) {
      throw new CreditError("This repo's highlight queue is full (24h max).");
    }

    const startsAt = queueEnd ? new Date(queueEnd) : new Date();
    const endsAt = new Date(startsAt.getTime() + minutes * 60_000);

    const type = kind === "self" ? "spend_self_highlight" : "spend_donation";
    const [highlight] = await tx
      .insert(highlights)
      .values({
        repoId,
        purchasedByUserId: userId,
        source: kind,
        startsAt,
        endsAt,
        minutesTotal: minutes,
      })
      .returning({ id: highlights.id });

    const entryId = await applyDelta(tx, userId, {
      delta: -1,
      type,
      highlightId: highlight.id,
    });
    await tx
      .update(highlights)
      .set({ creditEntryId: entryId })
      .where(eq(highlights.id, highlight.id));
    await writeAudit(tx, {
      actorUserId: userId,
      actorType: "user",
      action: kind === "self" ? "highlight.self" : "highlight.donate",
      entityType: "highlight",
      entityId: highlight.id,
      metadata: { repoId, minutes },
    });
    log.info("credit.spend", { userId, repoId, kind, minutes, highlightId: highlight.id });
    return highlight.id;
  });
}

/** Approve a social share and grant its +1 reward, atomically. */
export async function grantShareReward(shareId: string, adminUserId: string) {
  return db.transaction(async (tx) => {
    const [share] = await tx
      .select()
      .from(socialShares)
      .where(eq(socialShares.id, shareId))
      .for("update");
    if (!share || share.status !== "pending") return false;

    await lockUser(tx, share.userId);
    const [entry] = await tx
      .insert(creditEntries)
      .values({
        userId: share.userId,
        delta: 1,
        type: "social_share_reward",
        socialShareId: shareId,
        adminUserId,
        memo: `${share.platform} share`,
      })
      .onConflictDoNothing()
      .returning({ id: creditEntries.id });
    if (!entry) return false;

    await tx
      .update(users)
      .set({ creditBalance: sql`${users.creditBalance} + 1` })
      .where(eq(users.id, share.userId));
    await tx
      .update(socialShares)
      .set({ status: "approved", reviewedByUserId: adminUserId, reviewedAt: new Date() })
      .where(eq(socialShares.id, shareId));
    await writeAudit(tx, {
      actorUserId: adminUserId,
      actorType: "admin",
      action: "share.approve",
      entityType: "social_share",
      entityId: shareId,
      metadata: { userId: share.userId, platform: share.platform },
    });
    log.info("share.approved", { shareId, userId: share.userId });
    return true;
  });
}

/** Revoke a share reward (post deleted within the 7-day window). The debit
 * can push the balance negative — same debt model as star clawbacks. */
export async function clawbackShareReward(shareId: string, reason: string) {
  return db.transaction(async (tx) => {
    const [share] = await tx
      .select()
      .from(socialShares)
      .where(eq(socialShares.id, shareId))
      .for("update");
    if (!share || share.status !== "approved") return;

    await lockUser(tx, share.userId);
    const [entry] = await tx
      .insert(creditEntries)
      .values({
        userId: share.userId,
        delta: -1,
        type: "social_share_clawback",
        socialShareId: shareId,
        memo: reason,
      })
      .onConflictDoNothing()
      .returning({ id: creditEntries.id });
    if (!entry) return;

    await tx
      .update(users)
      .set({ creditBalance: sql`${users.creditBalance} - 1` })
      .where(eq(users.id, share.userId));
    await tx
      .update(socialShares)
      .set({ status: "revoked" })
      .where(eq(socialShares.id, shareId));
    await writeAudit(tx, {
      actorType: "system",
      action: "share.clawback",
      entityType: "social_share",
      entityId: shareId,
      metadata: { userId: share.userId, reason },
    });
    log.info("share.clawback", { shareId, userId: share.userId, reason });
  });
}

/**
 * Clawback for a star revoked within the 100-day window. Recovery order:
 * debit the mint; if the balance goes negative, refund-cancel the user's
 * scheduled (not started) highlights newest-first; then truncate their
 * currently active highlight without refund; any remainder stays as debt.
 */
export async function clawbackMint(starMintId: string) {
  return db.transaction(async (tx) => {
    const [mint] = await tx
      .select()
      .from(starMints)
      .where(eq(starMints.id, starMintId))
      .for("update");
    if (!mint || mint.status !== "minted") return;

    const user = await lockUser(tx, mint.userId);

    // Partial unique index on (star_mint_id) WHERE type='revocation_clawback'
    // makes a double clawback impossible even under races.
    const [entry] = await tx
      .insert(creditEntries)
      .values({
        userId: mint.userId,
        delta: -1,
        type: "revocation_clawback",
        starMintId,
      })
      .onConflictDoNothing()
      .returning({ id: creditEntries.id });
    if (!entry) return;

    await tx
      .update(users)
      .set({ creditBalance: sql`${users.creditBalance} - 1` })
      .where(eq(users.id, mint.userId));
    await tx
      .update(starMints)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(starMints.id, starMintId));

    let balance = user.creditBalance - 1;

    if (balance < 0) {
      const scheduled = await tx
        .select()
        .from(highlights)
        .where(
          and(
            eq(highlights.purchasedByUserId, mint.userId),
            eq(highlights.status, "scheduled"),
            gte(highlights.startsAt, sql`now()`)
          )
        )
        .orderBy(desc(highlights.createdAt));
      for (const h of scheduled) {
        if (balance >= 0) break;
        await tx
          .update(highlights)
          .set({
            status: "cancelled",
            cancelledAt: new Date(),
            cancelReason: "revocation_clawback",
          })
          .where(eq(highlights.id, h.id));
        await applyDelta(tx, mint.userId, {
          delta: 1,
          type: "highlight_cancellation_refund",
          highlightId: h.id,
        });
        balance += 1;
      }
    }

    if (balance < 0) {
      const [active] = await tx
        .select()
        .from(highlights)
        .where(
          and(
            eq(highlights.purchasedByUserId, mint.userId),
            sql`${highlights.status} IN ('scheduled', 'active')`,
            sql`${highlights.startsAt} <= now()`,
            gt(highlights.endsAt, sql`now()`)
          )
        )
        .limit(1);
      if (active) {
        // Truncate the running highlight; no refund for elapsed or remaining time.
        await tx
          .update(highlights)
          .set({
            status: "cancelled",
            endsAt: new Date(),
            cancelledAt: new Date(),
            cancelReason: "revocation_clawback",
          })
          .where(eq(highlights.id, active.id));
      }
    }

    await writeAudit(tx, {
      actorUserId: null,
      actorType: "system",
      action: "credit.clawback",
      entityType: "star_mint",
      entityId: starMintId,
      metadata: { userId: mint.userId, finalBalance: balance },
    });
    log.info("credit.clawback", { starMintId, userId: mint.userId, finalBalance: balance });
  });
}
