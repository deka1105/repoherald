import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { repoListItems, repoLists, repos, users } from "@/db/schema";

export type RepoList = typeof repoLists.$inferSelect;

export const MAX_LISTS_PER_USER = 25;
export const MAX_ITEMS_PER_LIST = 200;
export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 300;
export const NOTE_MAX = 140;

/**
 * How a list's items can be ordered.
 *
 * `added` is first because it is the existing behaviour and stays the default:
 * a curated list reads in the order its owner built it. The others exist
 * because a list of 200 saved repos is not something you read, it is something
 * you look through.
 */
export const LIST_SORTS = ["added", "recent", "stars", "name"] as const;
export type ListSort = (typeof LIST_SORTS)[number];

export const LIST_SORT_LABELS: Record<ListSort, string> = {
  added: "Order added",
  recent: "Recently added",
  stars: "Most stars",
  name: "Name (A–Z)",
};

/** Same floor as the site search: one character matches most of a list. */
export const LIST_SEARCH_MIN = 2;

/** Narrow an untrusted `?sort=` to a known column ordering. */
export function parseListSort(raw: string | undefined): ListSort {
  return LIST_SORTS.includes(raw as ListSort) ? (raw as ListSort) : "added";
}

/** Share-link slug: readable stem + random suffix, so lists can't be found by
 * guessing titles and two lists named "AI tools" never collide. */
export function newSlug(title: string): string {
  const stem =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "list";
  return `${stem}-${randomBytes(3).toString("hex")}`;
}

/** Accepts a full GitHub URL, "owner/name", or a bare repo name as typed. */
export function parseRepoInput(raw: string): string | null {
  const trimmed = raw.trim().replace(/\.git$/i, "").replace(/\/+$/, "");
  const url = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+\/[\w.-]+)/i.exec(
    trimmed
  );
  if (url) return url[1];
  if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) return trimmed;
  return null;
}

export async function getListBySlug(slug: string) {
  const [row] = await db
    .select({ list: repoLists, ownerLogin: users.githubLogin })
    .from(repoLists)
    .innerJoin(users, eq(repoLists.ownerUserId, users.id))
    .where(eq(repoLists.slug, slug))
    .limit(1);
  return row ?? null;
}

/**
 * The items on a list, optionally filtered and reordered.
 *
 * Both options are omitted by callers that want the whole list in its curated
 * order — the mobile API does — so the default behaviour is exactly what it
 * was before searching existed.
 *
 * The note is searched alongside the repo's own fields on purpose. "A line on
 * why each is there" is the thing a saved-posts folder does not have, so it is
 * the most likely thing someone actually remembers: not the repo's name, but
 * what they said about it.
 */
export async function getListItems(
  listId: string,
  opts: { q?: string; sort?: ListSort } = {}
) {
  const q = opts.q?.trim() ?? "";
  const searching = q.length >= LIST_SEARCH_MIN;

  // Escape LIKE wildcards, or a query of "%" quietly matches every row.
  const term = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  // Every ordering gets createdAt as a tiebreaker so equal stars or duplicate
  // names cannot shuffle between requests — a list that reorders itself on
  // refresh reads as a bug.
  const order = {
    added: [asc(repoListItems.createdAt)],
    recent: [desc(repoListItems.createdAt)],
    stars: [desc(repos.starsCount), asc(repoListItems.createdAt)],
    // lower() because this database's collation is C.UTF-8, which is byte
    // order: a plain ASC puts every capitalised name ahead of every lowercase
    // one, so "zod" and "axios" would sit below "Zebra". Nobody reads that as
    // A-Z. The index on full_name goes unused, which is irrelevant at the
    // 200-item cap.
    name: [asc(sql`lower(${repos.fullName})`), asc(repoListItems.createdAt)],
  }[opts.sort ?? "added"];

  return db
    .select({
      itemId: repoListItems.id,
      note: repoListItems.note,
      addedAt: repoListItems.createdAt,
      addedByUserId: repoListItems.addedByUserId,
      addedByLogin: users.githubLogin,
      repo: repos,
    })
    .from(repoListItems)
    .innerJoin(repos, eq(repoListItems.repoId, repos.id))
    .innerJoin(users, eq(repoListItems.addedByUserId, users.id))
    // Removed listings stay out of every list without needing a cleanup job.
    .where(
      and(
        eq(repoListItems.listId, listId),
        sql`${repos.status} <> 'removed'`,
        searching
          ? or(
              ilike(repos.fullName, term),
              ilike(repos.description, term),
              ilike(repos.primaryLanguage, term),
              ilike(repos.ownerLogin, term),
              ilike(repoListItems.note, term)
            )
          : undefined
      )
    )
    .orderBy(...order);
}

/** A user's own lists, newest first, with live item counts. */
export async function getUserLists(userId: string) {
  const lists = await db
    .select()
    .from(repoLists)
    .where(and(eq(repoLists.ownerUserId, userId), eq(repoLists.status, "active")))
    .orderBy(desc(repoLists.createdAt));
  if (lists.length === 0) return [];

  // Counted in a second query rather than a correlated subquery in the SELECT
  // list. Drizzle renders an interpolated column unqualified in a select field
  // (it qualifies them in WHERE), so the obvious version compiled to
  //   SELECT count(*) FROM repo_list_items WHERE "list_id" = "id"
  // where both names resolved to the INNER table — asking how many items have
  // a list_id equal to their own primary key. Always zero, never an error, and
  // every list read "0 repos" while its page showed them all. A GROUP BY
  // cannot correlate to the wrong table, so it cannot fail this way.
  const counts = await db
    .select({ listId: repoListItems.listId, n: sql<number>`count(*)::int` })
    .from(repoListItems)
    // Same exclusion getListItems() applies, so the number on this page and
    // the rows on the list's own page can never disagree.
    .innerJoin(repos, eq(repos.id, repoListItems.repoId))
    .where(
      and(
        inArray(
          repoListItems.listId,
          lists.map((l) => l.id)
        ),
        sql`${repos.status} <> 'removed'`
      )
    )
    .groupBy(repoListItems.listId);

  const byList = new Map(counts.map((c) => [c.listId, c.n]));
  return lists.map((list) => ({ list, itemCount: byList.get(list.id) ?? 0 }));
}

/** Lists the user owns that don't already contain this repo — the options
 * behind "Add to list" on a repo page. The slug comes back because the mobile
 * API addresses lists by slug, not id. */
export async function getListsMissingRepo(userId: string, repoId: string) {
  return db
    .select({ id: repoLists.id, slug: repoLists.slug, title: repoLists.title })
    .from(repoLists)
    .where(
      and(
        eq(repoLists.ownerUserId, userId),
        eq(repoLists.status, "active"),
        sql`NOT EXISTS (
          SELECT 1 FROM ${repoListItems}
          WHERE ${repoListItems.listId} = ${repoLists.id}
            AND ${repoListItems.repoId} = ${repoId}
        )`
      )
    )
    .orderBy(desc(repoLists.createdAt));
}
