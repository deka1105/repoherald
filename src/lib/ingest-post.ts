import "server-only";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  ingestRepoCandidates,
  ingestSightings,
  repoListItems,
  repos,
  users,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getFlag } from "@/lib/settings";
import {
  ensurePlatformList,
  HANDLE_COLUMN,
  normaliseHandle,
  PLATFORM_LABEL,
  type Platform,
} from "@/lib/platform-lists";

/** Audit action written when an admin turns ingest auto-posting on. */
export const AUTO_POST_ENABLED_ACTION = "settings.ingest_auto_post.on";

type Candidate = typeof ingestRepoCandidates.$inferSelect;

export type PostOutcome =
  | { ok: true; repoId: string; listId: string }
  | { ok: false; reason: string };

/** Only these platforms have a handle column and therefore an owner. */
function asPlatform(p: string): Platform | null {
  return p === "instagram" || p === "tiktok" ? p : null;
}

/**
 * Who a candidate belongs to: the account that has claimed the handle which
 * sent it. Returns the senders seen so that the admin queue can say *why*
 * there is no owner rather than just greying a button out.
 */
export async function candidateOwner(candidate: Candidate): Promise<{
  userId: string | null;
  platform: Platform | null;
  senders: string[];
}> {
  const platform = asPlatform(candidate.platform);
  const rows = await db
    .select({ sender: ingestSightings.senderUsername })
    .from(ingestSightings)
    .where(eq(ingestSightings.candidateId, candidate.id))
    .orderBy(asc(ingestSightings.createdAt));

  const senders = [
    ...new Set(
      rows
        .map((r) => (r.sender ? normaliseHandle(r.sender) : null))
        .filter((s): s is string => Boolean(s))
    ),
  ];
  if (!platform || senders.length === 0) {
    return { userId: null, platform, senders };
  }

  // First sender wins when several people sent the same repo: it files into the
  // list of whoever brought it in first, rather than duplicating it into all of
  // them or silently picking an arbitrary one.
  const owners = await db
    .select({ id: users.id, handle: HANDLE_COLUMN[platform] })
    .from(users)
    .where(inArray(HANDLE_COLUMN[platform], senders));

  const byHandle = new Map(owners.map((o) => [o.handle, o.id]));
  for (const sender of senders) {
    const id = byHandle.get(sender);
    if (id) return { userId: id, platform, senders };
  }
  return { userId: null, platform, senders };
}

/**
 * File one candidate into its sender's private platform list.
 *
 * This no longer puts anything on the public feed. A repo somebody sent from
 * their own DMs is theirs to keep, not a listing — and listing it would have
 * required a poster who does not own it.
 *
 * The repo row is still written, because repo_list_items.repo_id is a foreign
 * key and AGENTS.md makes "list items may only reference repos already in
 * repos" an invariant. It is written `status: 'hidden'`, which the feed filters
 * out, so the repo exists to be referenced without being published. The owner
 * is recorded as postedByUserId for the same reason the column is NOT NULL:
 * somebody is answerable for every row.
 */
export async function postCandidate(
  candidate: Candidate,
  actorUserId: string,
  actorType: "admin" | "moderator" | "user",
  auditAction: "ingest.promote" | "ingest.autopost" | "ingest.backfill"
): Promise<PostOutcome> {
  if (candidate.promotedRepoId) return { ok: false, reason: "Already filed." };

  if (candidate.githubRepoId == null) {
    return {
      ok: false,
      reason:
        "No GitHub repo id on this candidate, so it cannot be filed yet. " +
        "Re-run resolution in repoHeraldIG to confirm the repo exists.",
    };
  }

  const { userId, platform, senders } = await candidateOwner(candidate);
  if (!platform) {
    return { ok: false, reason: `No private lists exist for ${candidate.platform}.` };
  }
  if (!userId) {
    return {
      ok: false,
      reason: senders.length
        ? `No account has claimed @${senders[0]} on ${platform}, so there is nobody to file this for.`
        : "This sighting has no known sender, so it has no owner.",
    };
  }

  const list = await ensurePlatformList(userId, platform);

  try {
    let repoId = "";
    await db.transaction(async (tx) => {
      // The repo may already exist — somebody listed it the ordinary way, or
      // another member was sent the same thing. Reuse it rather than colliding
      // with the unique github_repo_id.
      const [existing] = await tx
        .select({ id: repos.id })
        .from(repos)
        .where(eq(repos.githubRepoId, candidate.githubRepoId!))
        .limit(1);

      if (existing) {
        repoId = existing.id;
      } else {
        const [created] = await tx
          .insert(repos)
          .values({
            githubRepoId: candidate.githubRepoId!,
            fullName: candidate.fullName,
            ownerLogin: candidate.ownerLogin,
            name: candidate.name,
            description: candidate.description,
            primaryLanguage: candidate.primaryLanguage,
            starsCount: candidate.starsCount,
            avatarUrl: candidate.avatarUrl,
            isArchived: candidate.isArchived,
            postedByUserId: userId,
            // Hidden, not active: this is a private find, not a listing.
            status: "hidden",
          })
          .returning({ id: repos.id });
        repoId = created.id;
      }

      await tx
        .insert(repoListItems)
        .values({ listId: list.id, repoId, addedByUserId: userId })
        // The (list_id, repo_id) unique index means a repeat is a no-op.
        .onConflictDoNothing();

      await tx
        .update(ingestRepoCandidates)
        .set({
          status: "promoted",
          promotedRepoId: repoId,
          reviewedByUserId: actorUserId,
          reviewedAt: new Date(),
        })
        .where(eq(ingestRepoCandidates.id, candidate.id));

      await writeAudit(tx, {
        actorUserId,
        actorType,
        action: auditAction,
        entityType: "repo_list_item",
        entityId: repoId,
        metadata: {
          fullName: candidate.fullName,
          candidateId: candidate.id,
          platform,
          listId: list.id,
          filedForUserId: userId,
          automatic: auditAction === "ingest.autopost",
        },
      });
    });
    return { ok: true, repoId, listId: list.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: message };
  }
}

/**
 * Who auto-filed repos are recorded as having been actioned by.
 *
 * `app_settings.value` is an integer, so the enabling admin cannot be stored
 * beside the flag. The audit log already records who flipped it and when, so
 * that is the source of truth. Note this is the *actor*, not the owner — the
 * repo is filed for whoever sent it, never for this account.
 *
 * Returns null when nobody can be identified, or when that account is no longer
 * an admin, and the sweep then does nothing.
 */
export async function autoPostActor(): Promise<{
  id: string;
  login: string | null;
} | null> {
  const [row] = await db
    .select({ actorUserId: auditLog.actorUserId })
    .from(auditLog)
    .where(eq(auditLog.action, AUTO_POST_ENABLED_ACTION))
    .orderBy(desc(auditLog.createdAt))
    .limit(1);

  if (!row?.actorUserId) return null;

  const [user] = await db
    .select({ id: users.id, login: users.githubLogin, role: users.role })
    .from(users)
    .where(eq(users.id, row.actorUserId))
    .limit(1);

  if (!user || user.role !== "admin") return null;
  return { id: user.id, login: user.login };
}

export type SweepResult = {
  posted: number;
  skipped: { fullName: string; reason: string }[];
  haltedBecause?: string;
};

/**
 * File every candidate still waiting, oldest first. Safe to call repeatedly:
 * anything already filed carries `promotedRepoId` and is not selected, and a
 * candidate whose sender nobody has claimed is skipped and stays in the queue.
 */
export async function autoPostPendingCandidates(limit = 50): Promise<SweepResult> {
  if (!(await getFlag("ingestAutoPost"))) {
    return { posted: 0, skipped: [], haltedBecause: "Auto-filing is off." };
  }

  const actor = await autoPostActor();
  if (!actor) {
    return {
      posted: 0,
      skipped: [],
      haltedBecause:
        "No admin is on record as having enabled auto-filing. Toggle it off " +
        "and on again to claim it.",
    };
  }

  const waiting = await db
    .select()
    .from(ingestRepoCandidates)
    // 'approved' is included deliberately: those are rows reviewed under the
    // old two-step flow that were never filed.
    .where(inArray(ingestRepoCandidates.status, ["pending", "approved"]))
    .orderBy(asc(ingestRepoCandidates.discoveredAt))
    .limit(limit);

  const result: SweepResult = { posted: 0, skipped: [] };
  for (const candidate of waiting) {
    const outcome = await postCandidate(candidate, actor.id, "admin", "ingest.autopost");
    if (outcome.ok) result.posted += 1;
    else result.skipped.push({ fullName: candidate.fullName, reason: outcome.reason });
  }
  return result;
}

export type BackfillResult = {
  /** Candidates filed for the first time by this call. */
  filed: number;
  /** Repos filed before the handle was claimed, now shown in the list too. */
  linked: number;
  /** Unreviewed candidates left for a moderator, because auto-filing is off. */
  waiting: number;
  skipped: { fullName: string; reason: string }[];
};

/**
 * Show someone everything that arrived from their handle BEFORE they claimed it.
 *
 * repoHeraldIG sweeps DMs continuously, so finds routinely land weeks before
 * the person who sent them has an account — and until now claiming a handle
 * created an empty list and left that history stranded in the admin queue. A
 * claim is the moment the handle and the account are connected, so it is the
 * moment the backlog should appear.
 *
 * Two kinds of history, deliberately handled differently:
 *
 *  - Never filed (pending/approved). Filed now, through the same postCandidate
 *    used by the admin button and the sweep, so one code path decides what a
 *    filed repo looks like. Unreviewed ones are only filed when auto-filing is
 *    on: if an admin has chosen that a human looks first, claiming a handle is
 *    not a way around that. They are counted as `waiting` rather than skipped,
 *    because nothing is wrong with them.
 *
 *  - Already filed (promoted), including the ones posted under the old
 *    publish-to-feed behaviour. The repo exists and the candidate is spent, so
 *    there is nothing to file; it just was never shown to the person who sent
 *    it. Only a list item is added. The repo's own status is left exactly as it
 *    is — pulling a published repo off the feed is a separate decision and not
 *    one to make quietly inside somebody pressing "Claim".
 *
 * Ownership is re-resolved per candidate rather than assumed from the handle,
 * so when several people sent the same repo it still lands with whoever brought
 * it in first. Idempotent: filed candidates carry promotedRepoId and list items
 * are guarded by the (list_id, repo_id) unique index, so re-claiming is a no-op.
 */
export async function backfillForHandle(
  userId: string,
  platform: Platform,
  handle: string,
  limit = 200
): Promise<BackfillResult> {
  const result: BackfillResult = { filed: 0, linked: 0, waiting: 0, skipped: [] };

  const normalised = normaliseHandle(handle);
  if (!normalised) return result;

  // Senders are stored as the scraper saw them ("@Deka_1105", "deka_1105"),
  // so matching happens through normaliseHandle rather than in SQL — one
  // definition of what a handle is, shared with the rest of the ingest path.
  const rows = await db
    .select({
      candidate: ingestRepoCandidates,
      sender: ingestSightings.senderUsername,
    })
    .from(ingestRepoCandidates)
    .innerJoin(
      ingestSightings,
      eq(ingestSightings.candidateId, ingestRepoCandidates.id)
    )
    .where(
      and(
        eq(ingestRepoCandidates.platform, platform),
        // A rejected candidate stays rejected. Claiming a handle is not an
        // appeal against a moderator.
        ne(ingestRepoCandidates.status, "rejected")
      )
    )
    .orderBy(asc(ingestRepoCandidates.discoveredAt));

  const mine = new Map<string, Candidate>();
  for (const row of rows) {
    if (mine.size >= limit) break;
    const sender = row.sender ? normaliseHandle(row.sender) : null;
    if (sender === normalised) mine.set(row.candidate.id, row.candidate);
  }
  if (mine.size === 0) return result;

  const list = await ensurePlatformList(userId, platform);
  const autoPost = await getFlag("ingestAutoPost");

  for (const candidate of mine.values()) {
    if (candidate.promotedRepoId) {
      const owner = await candidateOwner(candidate);
      if (owner.userId !== userId) {
        result.skipped.push({
          fullName: candidate.fullName,
          reason: "Already filed for whoever sent it first.",
        });
        continue;
      }
      const inserted = await db
        .insert(repoListItems)
        .values({
          listId: list.id,
          repoId: candidate.promotedRepoId,
          addedByUserId: userId,
        })
        .onConflictDoNothing()
        .returning({ id: repoListItems.id });
      if (inserted.length) result.linked += 1;
      continue;
    }

    if (candidate.status === "pending" && !autoPost) {
      result.waiting += 1;
      continue;
    }

    const outcome = await postCandidate(candidate, userId, "user", "ingest.backfill");
    if (!outcome.ok) {
      result.skipped.push({ fullName: candidate.fullName, reason: outcome.reason });
    } else if (outcome.listId === list.id) {
      result.filed += 1;
    }
  }

  if (result.filed || result.linked) {
    await writeAudit(db, {
      actorUserId: userId,
      actorType: "user",
      action: "ingest.backfill",
      entityType: "repo_list",
      entityId: list.id,
      metadata: {
        platform,
        handle: normalised,
        filed: result.filed,
        linked: result.linked,
        waiting: result.waiting,
      },
    });
  }

  return result;
}

/** One sentence a person can read, for the account page. */
export function describeBackfill(r: BackfillResult, platform: Platform): string | null {
  const label = PLATFORM_LABEL[platform];
  const shown = r.filed + r.linked;
  const parts: string[] = [];
  if (shown) {
    parts.push(
      `${shown} ${shown === 1 ? "repo" : "repos"} you sent before claiming ` +
        `${shown === 1 ? "it is" : "they are"} now in your ${label} list`
    );
  }
  if (r.waiting) {
    parts.push(
      `${r.waiting} more ${r.waiting === 1 ? "is" : "are"} waiting to be reviewed`
    );
  }
  if (!parts.length) return null;
  return `${parts.join(", and ")}.`;
}
