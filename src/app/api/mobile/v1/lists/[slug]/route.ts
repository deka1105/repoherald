import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { repoLists } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import {
  LIST_SEARCH_MIN,
  LIST_SORTS,
  LIST_SORT_LABELS,
  MAX_ITEMS_PER_LIST,
  NOTE_MAX,
  getListBySlug,
  getListItems,
  parseListSort,
} from "@/lib/lists";
import { getRepoSources, type RepoSource } from "@/lib/ingest-source";
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

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const sort = parseListSort(url.searchParams.get("sort") ?? undefined);
  // Below the floor the query is ignored rather than refused, as on the web: a
  // stray single character should show the list, not an error.
  const searching = query.length >= LIST_SEARCH_MIN;

  const row = await getListBySlug(slug);
  if (!row) return notFound("List not found");

  const { list } = row;
  const isStaff = user?.role === "admin" || user?.role === "moderator";
  const isOwner = user?.id === list.ownerUserId;
  if (list.status === "removed" && !isStaff) return notFound("List not found");
  if (list.visibility === "private" && !isOwner && !isStaff) {
    return notFound("List not found");
  }

  const [items, views] = await Promise.all([
    getListItems(list.id, { q: query, sort }),
    getListViewStats(slug),
  ]);

  // Source posts go to the owner and staff only, never to someone holding a
  // link -- the same gate as the web page, for the same reason. The lists these
  // repos land in are `private` already, but nothing stops a hidden ingest repo
  // being added to an *unlisted* list, which anyone with the URL can read, and
  // that would publish a third party's post link.
  //
  // One query for the whole response rather than one per item. It needs the
  // repo ids, so it cannot join the Promise.all above.
  const sources =
    isOwner || isStaff
      ? await getRepoSources(items.map((i) => i.repo.id))
      : new Map<string, RepoSource>();

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
    // Echoed so the app renders the state the server actually applied, rather
    // than what it believes it asked for -- `sort` in particular comes back
    // narrowed, and a query below the floor comes back as not searching.
    query: searching ? query : "",
    sort,
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
      // Absent for an owner-posted repo, and the card renders nothing for one
      // rather than implying a source that does not exist.
      source: sources.get(i.repo.id) ?? null,
    })),
    limits: {
      maxItems: MAX_ITEMS_PER_LIST,
      noteMax: NOTE_MAX,
      searchMin: LIST_SEARCH_MIN,
      sorts: LIST_SORTS.map((key) => ({ key, label: LIST_SORT_LABELS[key] })),
    },
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
