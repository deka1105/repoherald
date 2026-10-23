import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { repoComments } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { actorTypeOf } from "@/lib/authz";
import { fail, mobileUser, notFound, ok, unauthenticated } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/**
 * Retract your own comment; staff may remove anyone's.
 *
 * Soft-delete, matching `removeComment` on the web — the row stays auditable,
 * and a moderator can put it back from /admin/comments.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await mobileUser(req);
  if (!user) return unauthenticated();

  const comment = await db.query.repoComments.findFirst({
    where: eq(repoComments.id, id),
  });
  if (!comment) return notFound("Comment not found");

  const isStaff = user.role === "admin" || user.role === "moderator";
  if (comment.userId !== user.id && !isStaff) return fail("Not authorized", 403);

  await db
    .update(repoComments)
    .set({ status: "removed", removedByUserId: user.id, removedAt: new Date() })
    .where(eq(repoComments.id, id));

  if (isStaff && comment.userId !== user.id) {
    await writeAudit(db, {
      actorUserId: user.id,
      actorType: actorTypeOf(user),
      action: "comment.remove",
      entityType: "repo_comment",
      entityId: id,
      metadata: { repoId: comment.repoId, source: "mobile" },
    });
  }

  revalidatePath(`/repos/${comment.repoId}`);
  revalidatePath("/admin/comments");
  return ok({ removed: true });
}
