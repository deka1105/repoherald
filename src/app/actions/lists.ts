"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { repoListItems, repoLists, repos } from "@/db/schema";
import { actorTypeOf, requireUser } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import {
  DESCRIPTION_MAX,
  MAX_ITEMS_PER_LIST,
  MAX_LISTS_PER_USER,
  NOTE_MAX,
  TITLE_MAX,
  newSlug,
  parseRepoInput,
} from "@/lib/lists";

export type ListFormState = { error?: string; ok?: string };

function s(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}

/** Loads a list the caller is allowed to administer (owner, or staff for
 * moderation). Throws rather than returning — these paths are never reachable
 * from the UI unless the caller owns the list. */
async function requireOwnedList(listId: string, userId: string, role: string) {
  const list = await db.query.repoLists.findFirst({
    where: eq(repoLists.id, listId),
  });
  if (!list) throw new Error("List not found");
  const isStaff = role === "admin" || role === "moderator";
  if (list.ownerUserId !== userId && !isStaff) throw new Error("Not authorized");
  return list;
}

export async function createList(
  _prev: ListFormState,
  formData: FormData
): Promise<ListFormState> {
  const user = await requireUser();
  const title = s(formData, "title");
  const description = s(formData, "description");

  if (title.length < 3 || title.length > TITLE_MAX) {
    return { error: `Give the list a name of 3–${TITLE_MAX} characters.` };
  }
  if (description.length > DESCRIPTION_MAX) {
    return { error: `Description must be under ${DESCRIPTION_MAX} characters.` };
  }

  const [{ owned }] = await db
    .select({ owned: sql<number>`count(*)::int` })
    .from(repoLists)
    .where(
      and(eq(repoLists.ownerUserId, user.id), eq(repoLists.status, "active"))
    );
  if (owned >= MAX_LISTS_PER_USER && user.role !== "admin") {
    return { error: `You've reached the limit of ${MAX_LISTS_PER_USER} lists.` };
  }

  const [list] = await db
    .insert(repoLists)
    .values({
      ownerUserId: user.id,
      slug: newSlug(title),
      title,
      description: description || null,
    })
    .returning({ id: repoLists.id, slug: repoLists.slug });

  await writeAudit(db, {
    actorUserId: user.id,
    actorType: "user",
    action: "list.create",
    entityType: "repo_list",
    entityId: list.id,
    metadata: { title },
  });

  revalidatePath("/lists");
  redirect(`/lists/${list.slug}`);
}

export async function updateList(formData: FormData) {
  const user = await requireUser();
  const list = await requireOwnedList(s(formData, "listId"), user.id, user.role);
  const title = s(formData, "title");
  const description = s(formData, "description");
  const contributions = s(formData, "contributions") === "closed" ? "closed" : "open";

  if (title.length < 3 || title.length > TITLE_MAX) {
    redirect(`/lists/${list.slug}?err=${encodeURIComponent("Name must be 3–80 characters.")}`);
  }
  if (description.length > DESCRIPTION_MAX) {
    redirect(
      `/lists/${list.slug}?err=${encodeURIComponent(
        `Description must be under ${DESCRIPTION_MAX} characters.`
      )}`
    );
  }

  await db
    .update(repoLists)
    .set({
      title,
      description: description || null,
      contributions,
      updatedAt: new Date(),
    })
    .where(eq(repoLists.id, list.id));

  revalidatePath(`/lists/${list.slug}`);
  redirect(`/lists/${list.slug}?msg=${encodeURIComponent("List updated.")}`);
}

export async function deleteList(formData: FormData) {
  const user = await requireUser();
  const list = await requireOwnedList(s(formData, "listId"), user.id, user.role);
  // Items cascade with the list; the repos themselves are untouched.
  await db.delete(repoLists).where(eq(repoLists.id, list.id));
  await writeAudit(db, {
    actorUserId: user.id,
    actorType: user.id === list.ownerUserId ? "user" : "moderator",
    action: "list.delete",
    entityType: "repo_list",
    entityId: list.id,
    metadata: { title: list.title },
  });
  revalidatePath("/lists");
  redirect("/lists?msg=" + encodeURIComponent("List deleted."));
}

/** Shared insert path for both "add by URL" (list page) and "add to list"
 * (repo page). Returns a user-facing error string, or null on success. */
async function addRepo(
  listId: string,
  repoId: string,
  userId: string,
  note: string | null
): Promise<string | null> {
  const [{ items }] = await db
    .select({ items: sql<number>`count(*)::int` })
    .from(repoListItems)
    .where(eq(repoListItems.listId, listId));
  if (items >= MAX_ITEMS_PER_LIST) {
    return `This list is full (${MAX_ITEMS_PER_LIST} repos).`;
  }

  const [row] = await db
    .insert(repoListItems)
    .values({ listId, repoId, addedByUserId: userId, note })
    .onConflictDoNothing()
    .returning({ id: repoListItems.id });
  return row ? null : "That repo is already in this list.";
}

export async function addRepoToList(
  _prev: ListFormState,
  formData: FormData
): Promise<ListFormState> {
  const user = await requireUser();
  const slug = s(formData, "slug");
  const list = await db.query.repoLists.findFirst({
    where: and(eq(repoLists.slug, slug), eq(repoLists.status, "active")),
  });
  if (!list) return { error: "List not found." };
  // Anyone with the link may add while contributions are open; a closed list is
  // owner-only. Staff don't get an exception — this isn't a moderation path.
  if (list.contributions === "closed" && list.ownerUserId !== user.id) {
    return { error: "The owner has closed this list to new additions." };
  }

  const fullName = parseRepoInput(s(formData, "repo"));
  if (!fullName) {
    return { error: "Enter a repo as github.com/owner/name or owner/name." };
  }
  const note = s(formData, "note").slice(0, NOTE_MAX);

  const repo = await db.query.repos.findFirst({
    where: and(
      sql`lower(${repos.fullName}) = ${fullName.toLowerCase()}`,
      eq(repos.status, "active")
    ),
  });
  if (!repo) {
    return {
      error: `${fullName} isn't listed on repoherald yet — post it first (only its owner can), then add it here.`,
    };
  }

  const error = await addRepo(list.id, repo.id, user.id, note || null);
  if (error) return { error };

  revalidatePath(`/lists/${list.slug}`);
  return { ok: `Added ${repo.fullName}.` };
}

/** "Add to list" from a repo page — the list is picked, the repo is fixed. */
export async function addRepoToListById(formData: FormData) {
  const user = await requireUser();
  const listId = s(formData, "listId");
  const repoId = s(formData, "repoId");
  const list = await db.query.repoLists.findFirst({
    where: and(eq(repoLists.id, listId), eq(repoLists.status, "active")),
  });
  if (!list) throw new Error("List not found");
  if (list.contributions === "closed" && list.ownerUserId !== user.id) {
    throw new Error("List is closed to contributions");
  }
  await addRepo(list.id, repoId, user.id, null);
  revalidatePath(`/lists/${list.slug}`);
  redirect(`/lists/${list.slug}`);
}

export async function removeListItem(formData: FormData) {
  const user = await requireUser();
  const itemId = s(formData, "itemId");
  const [row] = await db
    .select({ item: repoListItems, list: repoLists })
    .from(repoListItems)
    .innerJoin(repoLists, eq(repoListItems.listId, repoLists.id))
    .where(eq(repoListItems.id, itemId))
    .limit(1);
  if (!row) throw new Error("Item not found");

  // The owner can remove anything from their list; a contributor can take back
  // only what they added themselves.
  const isOwner = row.list.ownerUserId === user.id;
  const isStaff = user.role === "admin" || user.role === "moderator";
  if (!isOwner && !isStaff && row.item.addedByUserId !== user.id) {
    throw new Error("Not authorized");
  }

  await db.delete(repoListItems).where(eq(repoListItems.id, itemId));
  revalidatePath(`/lists/${row.list.slug}`);
}

/** Moderation: hide an abusive list without deleting its owner's data. */
export async function setListStatus(listId: string, status: "active" | "removed") {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "moderator") {
    throw new Error("Not authorized");
  }
  await db
    .update(repoLists)
    .set({ status, updatedAt: new Date() })
    .where(eq(repoLists.id, listId));
  await writeAudit(db, {
    actorUserId: user.id,
    actorType: actorTypeOf(user),
    action: status === "removed" ? "list.remove" : "list.restore",
    entityType: "repo_list",
    entityId: listId,
  });
  revalidatePath("/admin/lists");
}
