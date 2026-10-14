import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, ingestRepoCandidates, repos, users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getFlag } from "@/lib/settings";

/** Audit action written when an admin turns ingest auto-posting on. */
export const AUTO_POST_ENABLED_ACTION = "settings.ingest_auto_post.on";

type Candidate = typeof ingestRepoCandidates.$inferSelect;

export type PostOutcome =
  | { ok: true; repoId: string }
  | { ok: false; reason: string };

/**
 * Put one candidate on the feed, as `actorUserId`.
 *
 * Returns a result rather than throwing, because the sweep below posts a batch
 * and one unlistable row must not abort the rest. The server action wraps this
 * and throws, so a moderator pressing the button still sees why it failed.
 *
 * One transaction: a repo inserted without its candidate being marked promoted
 * would be postable again, which is how the same listing appears twice.
 */
export async function postCandidate(
  candidate: Candidate,
  actorUserId: string,
  actorType: "admin" | "moderator",
  auditAction: "ingest.promote" | "ingest.autopost"
): Promise<PostOutcome> {
  if (candidate.promotedRepoId) return { ok: false, reason: "Already posted." };

  // githubRepoId is nullable on a candidate — a link can be recorded before
  // anything confirms the repo exists — but it is NOT NULL on `repos` and is
  // what keeps the feed free of duplicates. Refuse rather than invent one.
  if (candidate.githubRepoId == null) {
    return {
      ok: false,
      reason:
        "No GitHub repo id on this candidate, so it cannot be listed yet. " +
        "Re-run resolution in repoHeraldIG to confirm the repo exists.",
    };
  }

  try {
    let repoId = "";
    await db.transaction(async (tx) => {
      const [repo] = await tx
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
          postedByUserId: actorUserId,
        })
        .returning({ id: repos.id });

      await tx
        .update(ingestRepoCandidates)
        .set({
          status: "promoted",
          promotedRepoId: repo.id,
          reviewedByUserId: actorUserId,
          reviewedAt: new Date(),
        })
        .where(eq(ingestRepoCandidates.id, candidate.id));

      // `ingest.autopost` is deliberately NOT `ingest.promote`: the log has to
      // keep saying which listings a human actually looked at.
      await writeAudit(tx, {
        actorUserId,
        actorType,
        action: auditAction,
        entityType: "repo",
        entityId: repo.id,
        metadata: {
          fullName: candidate.fullName,
          candidateId: candidate.id,
          platform: candidate.platform,
          automatic: auditAction === "ingest.autopost",
        },
      });
      repoId = repo.id;
    });
    return { ok: true, repoId };
  } catch (e) {
    // The likeliest failure is the unique constraint on githubRepoId: someone
    // already listed this repo the ordinary way.
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("unique") || message.includes("duplicate")) {
      return { ok: false, reason: `${candidate.fullName} is already listed on the feed.` };
    }
    return { ok: false, reason: message };
  }
}

/**
 * Who auto-posted repos are listed as.
 *
 * `app_settings.value` is an integer, so the enabling admin cannot be stored
 * beside the flag. The audit log already records who flipped it and when, so
 * that is the source of truth: the most recent admin to turn auto-posting ON
 * is the one whose name goes on what it posts.
 *
 * Returns null when nobody can be identified, or when that account is no
 * longer an admin. The sweep then does nothing — an unattended job must not
 * publish under a guessed or stale identity.
 */
export async function autoPostActor(): Promise<{ id: string; login: string } | null> {
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
  /** Why nothing was attempted, when that is the case. */
  haltedBecause?: string;
};

/**
 * Post every candidate still waiting, oldest first. Safe to call repeatedly:
 * anything already posted carries `promotedRepoId` and is not selected.
 */
export async function autoPostPendingCandidates(limit = 50): Promise<SweepResult> {
  if (!(await getFlag("ingestAutoPost"))) {
    return { posted: 0, skipped: [], haltedBecause: "Auto-posting is off." };
  }

  const actor = await autoPostActor();
  if (!actor) {
    return {
      posted: 0,
      skipped: [],
      haltedBecause:
        "No admin is on record as having enabled auto-posting, so there is " +
        "nobody to list these under. Toggle it off and on again to claim it.",
    };
  }

  const waiting = await db
    .select()
    .from(ingestRepoCandidates)
    // 'approved' is included deliberately: those are rows reviewed under the
    // old two-step flow that were never listed.
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
