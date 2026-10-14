"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ingestRepoCandidates, repos } from "@/db/schema";
import { actorTypeOf, requireModerator } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";

/**
 * Mark a candidate reviewed. Approving says "a human looked at this and it is
 * worth listing"; it does not list it. Promotion is the separate, deliberate
 * act below, because that is the one that puts a stranger's repo on the feed
 * under somebody's name.
 */
async function setStatus(
  id: string,
  status: "approved" | "rejected",
  note: string | null
) {
  const actor = await requireModerator();

  const [row] = await db
    .update(ingestRepoCandidates)
    .set({
      status,
      reviewedByUserId: actor.id,
      reviewedAt: new Date(),
      reviewNote: note,
    })
    .where(eq(ingestRepoCandidates.id, id))
    .returning({ fullName: ingestRepoCandidates.fullName });

  if (!row) throw new Error("That candidate no longer exists.");

  await writeAudit(db, {
    actorUserId: actor.id,
    actorType: actorTypeOf(actor),
    action: `ingest.${status}`,
    entityType: "ingest_repo_candidate",
    entityId: id,
    metadata: { fullName: row.fullName, note },
  });

  revalidatePath("/admin/ingest");
}

export async function approveCandidate(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  return setStatus(id, "approved", note);
}

export async function rejectCandidate(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  return setStatus(id, "rejected", note);
}

/**
 * Promote a candidate into the live feed.
 *
 * `repos.postedByUserId` is NOT NULL, and the project's rule is that you may
 * only post a repo you own or are an org member of. Nobody owns a repo a
 * stranger sent us, so this writes the *moderator* as the posting user. That
 * is the point rather than a workaround: the check exists so that a human is
 * answerable for everything on the feed, and here that human is whoever
 * presses the button. The audit row records who.
 *
 * One transaction: a repo inserted without its candidate being marked promoted
 * would be promotable again, which is how the same listing appears twice.
 */
export async function promoteCandidate(formData: FormData) {
  const actor = await requireModerator();
  const id = String(formData.get("id") ?? "");

  const candidate = await db.query.ingestRepoCandidates.findFirst({
    where: eq(ingestRepoCandidates.id, id),
  });
  if (!candidate) throw new Error("That candidate no longer exists.");
  if (candidate.promotedRepoId) throw new Error("Already promoted.");

  // githubRepoId is nullable on a candidate — a link can be recorded before
  // anything confirms the repo exists — but it is NOT NULL on `repos` and is
  // what keeps the feed free of duplicates. Refuse rather than invent one.
  if (candidate.githubRepoId == null) {
    throw new Error(
      "No GitHub repo id on this candidate, so it cannot be listed yet. " +
        "Re-run resolution in repoHeraldIG to confirm the repo exists."
    );
  }

  try {
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
          postedByUserId: actor.id,
        })
        .returning({ id: repos.id });

      await tx
        .update(ingestRepoCandidates)
        .set({
          status: "promoted",
          promotedRepoId: repo.id,
          reviewedByUserId: actor.id,
          reviewedAt: new Date(),
        })
        .where(eq(ingestRepoCandidates.id, id));

      await writeAudit(tx, {
        actorUserId: actor.id,
        actorType: actorTypeOf(actor),
        action: "ingest.promote",
        entityType: "repo",
        entityId: repo.id,
        metadata: {
          fullName: candidate.fullName,
          candidateId: id,
          platform: candidate.platform,
        },
      });

      return repo.id;
    });

    revalidatePath("/admin/ingest");
    revalidatePath("/");
  } catch (e) {
    // The likeliest failure is the unique constraint on githubRepoId: someone
    // already listed this repo the ordinary way.
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("unique") || message.includes("duplicate")) {
      throw new Error(`${candidate.fullName} is already listed on the feed.`);
    }
    throw e;
  }
}
