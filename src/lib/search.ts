import "server-only";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { repoListItems, repoLists, repos } from "@/db/schema";

export type SearchHit = {
  repo: typeof repos.$inferSelect;
  /** Where the hit came from. Without this a result is just a repo; with it,
   *  it is an answer to "where did I put that?". */
  where: "list" | "public";
  listSlug: string | null;
  listTitle: string | null;
};

const MAX = 50;
/** Two characters, so "go" and "ai" work but an empty box doesn't list everything. */
const MIN_QUERY = 2;

/**
 * ILIKE rather than a tsvector column, deliberately. The table holds a few
 * dozen rows; a GIN index and a migration to maintain it would be machinery
 * for a problem nobody has. Substring matching is also the better behaviour at
 * this size: full-text would stem "scraping" away from "scraper" and miss
 * partial names like "sherl". Revisit at a few thousand repos, when a pg_trgm
 * index on (full_name, description) is the cheap next step.
 */
function matching(q: string) {
  // Escape LIKE wildcards, or a query of "%" quietly matches the whole table.
  const term = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return or(
    ilike(repos.fullName, term),
    ilike(repos.description, term),
    ilike(repos.primaryLanguage, term),
    ilike(repos.ownerLogin, term)
  );
}

/**
 * Search what this person is allowed to see, and say where each hit lives.
 *
 * Two sources, and the boundary between them is the privacy rule: public
 * listings are `status = 'active'`, which excludes every repo filed from a DM
 * (those are written `hidden`); the personal half is reached only through
 * repo_lists rows this user OWNS. A hidden repo therefore surfaces for the
 * person whose list holds it and for nobody else. Signed out, `userId` is null
 * and only the public half runs.
 */
export async function searchRepos(
  qRaw: string,
  userId: string | null
): Promise<SearchHit[]> {
  const q = qRaw.trim();
  if (q.length < MIN_QUERY) return [];

  const [publicRows, mineRows] = await Promise.all([
    db
      .select({ repo: repos })
      .from(repos)
      .where(and(eq(repos.status, "active"), matching(q)))
      .limit(MAX),
    userId
      ? db
          .select({ repo: repos, slug: repoLists.slug, title: repoLists.title })
          .from(repoListItems)
          .innerJoin(repos, eq(repos.id, repoListItems.repoId))
          .innerJoin(repoLists, eq(repoLists.id, repoListItems.listId))
          .where(and(eq(repoLists.ownerUserId, userId), matching(q)))
          .limit(MAX)
      : Promise.resolve([]),
  ]);

  const mine: SearchHit[] = mineRows.map((r) => ({
    repo: r.repo,
    where: "list",
    listSlug: r.slug,
    listTitle: r.title,
  }));

  // Your own copy wins when a repo is both saved and listed: "it's in your
  // Instagram finds" is the answer you were looking for, not "it's on the site".
  const saved = new Set(mine.map((h) => h.repo.id));
  const rest: SearchHit[] = publicRows
    .filter((r) => !saved.has(r.repo.id))
    .map((r) => ({ repo: r.repo, where: "public", listSlug: null, listTitle: null }));

  return [...mine, ...rest].slice(0, MAX);
}
