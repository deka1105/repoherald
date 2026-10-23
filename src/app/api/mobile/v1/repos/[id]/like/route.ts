import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { repoLikes, repos } from "@/db/schema";
import { getLikeState } from "@/lib/social";
import { mobileUser, notFound, ok, unauthenticated } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/**
 * Toggle this viewer's like.
 *
 * Insert-or-delete keyed on the unique index, exactly as `toggleLike` does on
 * the web: two rapid taps cannot create two rows, and no read-then-write race
 * can double-count. The new count comes back so an optimistic button can
 * settle on the truth rather than drifting.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await mobileUser(req);
  if (!user) return unauthenticated();

  const repo = await db.query.repos.findFirst({ where: eq(repos.id, id) });
  if (!repo || repo.status === "removed") return notFound("Repo not found");

  const [inserted] = await db
    .insert(repoLikes)
    .values({ repoId: id, userId: user.id })
    .onConflictDoNothing()
    .returning({ id: repoLikes.id });

  if (!inserted) {
    await db
      .delete(repoLikes)
      .where(and(eq(repoLikes.repoId, id), eq(repoLikes.userId, user.id)));
  }

  // Keep the web page in step — the same account is very often open in both.
  revalidatePath(`/repos/${id}`);

  const { count } = await getLikeState(id, user.id);
  return ok({ liked: Boolean(inserted), likeCount: count });
}
