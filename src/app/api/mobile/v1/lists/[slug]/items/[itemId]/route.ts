import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { repoListItems, repoLists } from "@/db/schema";
import { fail, mobileUser, notFound, ok, unauthenticated } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/** Take a repo back out of a list. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string; itemId: string }> }
) {
  const { itemId } = await params;
  const user = await mobileUser(req);
  if (!user) return unauthenticated();

  const [row] = await db
    .select({ item: repoListItems, list: repoLists })
    .from(repoListItems)
    .innerJoin(repoLists, eq(repoListItems.listId, repoLists.id))
    .where(eq(repoListItems.id, itemId))
    .limit(1);
  if (!row) return notFound("Item not found");

  // The owner can remove anything from their list; a contributor can take
  // back only what they added themselves.
  const isOwner = row.list.ownerUserId === user.id;
  const isStaff = user.role === "admin" || user.role === "moderator";
  if (!isOwner && !isStaff && row.item.addedByUserId !== user.id) {
    return fail("Not authorized", 403);
  }

  await db.delete(repoListItems).where(eq(repoListItems.id, itemId));
  revalidatePath(`/lists/${row.list.slug}`);
  return ok({ removed: true });
}
