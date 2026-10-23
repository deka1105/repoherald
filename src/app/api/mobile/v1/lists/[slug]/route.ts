import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { repoLists } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { MAX_ITEMS_PER_LIST, NOTE_MAX, getListBySlug, getListItems } from "@/lib/lists";
import { getListViewStats } from "@/lib/view-stats";
import { fail, mobileUser, notFound, ok, unauthenticated } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/**
 * A list and its repos.
 *
 * The visibility rule is the web's, and it has to stay identical: "unlisted"
 * is link-shareable by design, "private" is not. Both 404 rather than 403 for
 * someone who may not see them — a 403 would confirm the slug exists, which is
 * the whole thing the random slug suffix is there to avoid.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await mobileUser(req);

  const row = await getListBySlug(slug);
  if (!row) return notFound("List not found");

  const { list } = row;
  const isStaff = user?.role === "admin" || user?.role === "moderator";
  const isOwner = Boolean(user) && user!.id === list.ownerUserId;
  if (list.status === "removed" && !isStaff) return notFound("List not found");
  if (list.visibility === "private" && !isOwner && !isStaff) {
    return notFound("List not found");
  }

  const [items, views] = await Promise.all([
    getListItems(list.id),
    getListViewStats(slug),
  ]);

  return ok({
    list: {
      id: list.id,
      slug: list.slug,
      title: list.title,
      description: list.description,
      contributions: list.contributions,
      visibility: list.visibility,
      source: list.source,
      createdAt: list.createdAt,
      ownerLogin: row.ownerLogin,
      isOwner,
      canAdd: Boolean(user) && (list.contributions === "open" || isOwner),
      views: views.views,
      visitors: views.visitors,
    },
    items: items.map((i) => ({
      itemId: i.itemId,
      note: i.note,
      addedAt: i.addedAt,
      addedByLogin: i.addedByLogin,
      // The owner may remove anything; a contributor only what they added.
      canRemove: Boolean(
        user && (isOwner || isStaff || i.addedByUserId === user.id)
      ),
      repo: {
        id: i.repo.id,
        fullName: i.repo.fullName,
        description: i.repo.description,
        primaryLanguage: i.repo.primaryLanguage,
        starsCount: i.repo.starsCount,
        avatarUrl: i.repo.avatarUrl,
        isArchived: i.repo.isArchived,
      },
    })),
    limits: { maxItems: MAX_ITEMS_PER_LIST, noteMax: NOTE_MAX },
  });
}

/** Delete a list. Its items cascade; the repos themselves are untouched. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await mobileUser(req);
  if (!user) return unauthenticated();

  const row = await getListBySlug(slug);
  if (!row) return notFound("List not found");

  const isStaff = user.role === "admin" || user.role === "moderator";
  if (row.list.ownerUserId !== user.id && !isStaff) {
    return fail("Not authorized", 403);
  }

  await db.delete(repoLists).where(eq(repoLists.id, row.list.id));
  await writeAudit(db, {
    actorUserId: user.id,
    actorType: user.id === row.list.ownerUserId ? "user" : "moderator",
    action: "list.delete",
    entityType: "repo_list",
    entityId: row.list.id,
    metadata: { title: row.list.title, source: "mobile" },
  });

  revalidatePath("/lists");
  return ok({ deleted: true });
}
