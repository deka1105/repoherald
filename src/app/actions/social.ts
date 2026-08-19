"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { repoComments, repoLikes, repos } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { COMMENT_MAX, COMMENTS_PER_DAY } from "@/lib/social";

/** Toggle this viewer's like. Returns the new state so the button can settle
 * on the truth after its optimistic flip. */
export async function toggleLike(repoId: string): Promise<{ liked: boolean }> {
  const user = await requireUser();
  const repo = await db.query.repos.findFirst({ where: eq(repos.id, repoId) });
  if (!repo || repo.status === "removed") throw new Error("Repo not found");

  // Insert-or-delete keyed on the unique index: two rapid clicks can't create
  // two rows, and no read-then-write race can double-count.
  const [inserted] = await db
    .insert(repoLikes)
    .values({ repoId, userId: user.id })
    .onConflictDoNothing()
    .returning({ id: repoLikes.id });

  if (!inserted) {
    await db
      .delete(repoLikes)
      .where(and(eq(repoLikes.repoId, repoId), eq(repoLikes.userId, user.id)));
  }

  revalidatePath(`/repos/${repoId}`);
  return { liked: Boolean(inserted) };
}

export type CommentState = { error?: string };

export async function postComment(
  _prev: CommentState,
  formData: FormData
): Promise<CommentState> {
  const user = await requireUser();
  const repoId = String(formData.get("repoId") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (body.length < 2) return { error: "Say a little more than that." };
  if (body.length > COMMENT_MAX) {
    return { error: `Comments are limited to ${COMMENT_MAX} characters.` };
  }

  const repo = await db.query.repos.findFirst({ where: eq(repos.id, repoId) });
  if (!repo || repo.status === "removed") return { error: "Repo not found." };

  // Same UTC-day window as the posting and claim caps. Admins exempt.
  if (user.role !== "admin") {
    const [{ today }] = await db
      .select({ today: sql<number>`count(*)::int` })
      .from(repoComments)
      .where(
        and(
          eq(repoComments.userId, user.id),
          gte(repoComments.createdAt, sql`date_trunc('day', now())`)
        )
      );
    if (today >= COMMENTS_PER_DAY) {
      return { error: `Daily comment limit reached (${COMMENTS_PER_DAY}/day).` };
    }
  }

  await db.insert(repoComments).values({ repoId, userId: user.id, body });
  revalidatePath(`/repos/${repoId}`);
  return {};
}

/** Authors retract their own comments; staff remove anyone's. Both soft-delete
 * so the row stays auditable. */
export async function removeComment(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("commentId") ?? "");
  const comment = await db.query.repoComments.findFirst({
    where: eq(repoComments.id, id),
  });
  if (!comment) throw new Error("Comment not found");

  const isStaff = user.role === "admin" || user.role === "moderator";
  if (comment.userId !== user.id && !isStaff) throw new Error("Not authorized");

  await db
    .update(repoComments)
    .set({ status: "removed", removedByUserId: user.id, removedAt: new Date() })
    .where(eq(repoComments.id, id));

  if (isStaff && comment.userId !== user.id) {
    await writeAudit(db, {
      actorUserId: user.id,
      actorType: user.role === "admin" ? "admin" : "moderator",
      action: "comment.remove",
      entityType: "repo_comment",
      entityId: id,
      metadata: { repoId: comment.repoId },
    });
  }

  revalidatePath(`/repos/${comment.repoId}`);
  revalidatePath("/admin/comments");
}

/** Moderation: put a removed comment back. */
export async function restoreComment(commentId: string) {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "moderator") {
    throw new Error("Not authorized");
  }
  const comment = await db.query.repoComments.findFirst({
    where: eq(repoComments.id, commentId),
  });
  if (!comment) throw new Error("Comment not found");

  await db
    .update(repoComments)
    .set({ status: "visible", removedByUserId: null, removedAt: null })
    .where(eq(repoComments.id, commentId));
  await writeAudit(db, {
    actorUserId: user.id,
    actorType: user.role === "admin" ? "admin" : "moderator",
    action: "comment.restore",
    entityType: "repo_comment",
    entityId: commentId,
  });

  revalidatePath(`/repos/${comment.repoId}`);
  revalidatePath("/admin/comments");
}
