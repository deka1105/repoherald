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
