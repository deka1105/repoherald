"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ingestRepoCandidates } from "@/db/schema";
import { actorTypeOf, requireModerator } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { postCandidate } from "@/lib/ingest-post";

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
 * The listing itself is written by postCandidate(), shared with the unattended
 * sweep behind the auto-post flag, so both routes produce identical rows and
 * differ only in the audit action and who is recorded as the poster.
 */
export async function approveCandidate(formData: FormData) {
  const actor = await requireModerator();
  const id = String(formData.get("id") ?? "");

  const candidate = await db.query.ingestRepoCandidates.findFirst({
    where: eq(ingestRepoCandidates.id, id),
  });
  if (!candidate) throw new Error("That candidate no longer exists.");

  const outcome = await postCandidate(
    candidate,
    actor.id,
    actor.role === "admin" ? "admin" : "moderator",
    "ingest.promote"
  );
  // The button is a form action, so throwing is how the reason reaches the
  // moderator who pressed it.
  if (!outcome.ok) throw new Error(outcome.reason);

  revalidatePath("/admin/ingest");
  revalidatePath("/");
}
