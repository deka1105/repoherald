"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ingestRepoCandidates, repos } from "@/db/schema";
import { actorTypeOf, requireModerator } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";

/**
 * Reject a candidate: a human looked and said no. Nothing is deleted — the
 * sighting rows stay, so the same repo arriving again is visibly a repeat
 * rather than a fresh discovery.
 */
export async function rejectCandidate(formData: FormData) {
  const actor = await requireModerator();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  const [row] = await db
    .update(ingestRepoCandidates)
    .set({
      status: "rejected",
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
    action: "ingest.rejected",
    entityType: "ingest_repo_candidate",
    entityId: id,
    metadata: { fullName: row.fullName, note },
  });

  revalidatePath("/admin/ingest");
}

/**
 * Approve a candidate, which posts it to the live feed.
 *
 * Approving and posting used to be two buttons: 'approved' meant "a human
 * looked", and a second press put it on the feed. In practice that produced a
 * queue of approved repos that nobody had published and no one could tell were
 * unpublished. One button, one meaning. Candidates still sitting at 'approved'
 * from the two-step era are offered this button again so they can be posted.
 *
 * `repos.postedByUserId` is NOT NULL, and the project's rule is that you may
 * only post a repo you own or are an org member of. Nobody owns a repo a
 * stranger sent us, so this writes the *moderator* as the posting user. That
 * is the point rather than a workaround: the check exists so that a human is
 * answerable for everything on the feed, and here that human is whoever
 * presses the button. The audit row records who.
 *
 * One transaction: a repo inserted without its candidate being marked promoted
 * would be approvable again, which is how the same listing appears twice.
 */
export async function approveCandidate(formData: FormData) {
  const actor = await requireModerator();
  const id = String(formData.get("id") ?? "");

  const candidate = await db.query.ingestRepoCandidates.findFirst({
    where: eq(ingestRepoCandidates.id, id),
  });
  if (!candidate) throw new Error("That candidate no longer exists.");
  if (candidate.promotedRepoId) throw new Error("Already posted.");

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

      // Kept as `ingest.promote` rather than renamed to match the button: the
      // log already holds `ingest.approved` rows that meant "reviewed, not
      // listed", and reusing that name for "is now on the feed" would make the
      // two indistinguishable after the fact.
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
