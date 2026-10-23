import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { repoListItems, repoLists, repos } from "@/db/schema";
import { MAX_ITEMS_PER_LIST, NOTE_MAX, parseRepoInput } from "@/lib/lists";
import { fail, jsonBody, mobileUser, notFound, ok, unauthenticated } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/**
 * Add a repo to a list.
 *
 * Accepts either `repoId` (the "add to list" button on a repo screen, where
 * the repo is already resolved) or `repo` as a URL / "owner/name" (the list
 * screen's own input). Both land on the same insert, so the caps and the
 * duplicate rule cannot differ between the two entry points.
 *
 * A list item may only reference a repo already in `repos`: accepting an
 * arbitrary GitHub URL here would create a listing that bypassed the
 * owner/org check in `postRepoFor`.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await mobileUser(req);
  if (!user) return unauthenticated();

  const body = await jsonBody(req);
  if (!body) return fail("Malformed body", 400);

  const list = await db.query.repoLists.findFirst({
    where: and(eq(repoLists.slug, slug), eq(repoLists.status, "active")),
  });
  if (!list) return notFound("List not found");
  // Anyone with the link may add while contributions are open; a closed list
  // is owner-only. Staff get no exception — this isn't a moderation path.
  if (list.contributions === "closed" && list.ownerUserId !== user.id) {
    return fail("The owner has closed this list to new additions.", 403);
  }

  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, NOTE_MAX) : "";

  let repoId: string;
  if (typeof body.repoId === "string" && body.repoId) {
    repoId = body.repoId;
  } else {
    const fullName = parseRepoInput(
      typeof body.repo === "string" ? body.repo : ""
    );
    if (!fullName) {
      return fail("Enter a repo as github.com/owner/name or owner/name.", 400);
    }
    const repo = await db.query.repos.findFirst({
      where: and(
        sql`lower(${repos.fullName}) = ${fullName.toLowerCase()}`,
        eq(repos.status, "active")
      ),
    });
    if (!repo) {
      return fail(
        `${fullName} isn't listed on repoherald yet — post it first (only its owner can), then add it here.`,
        404
      );
    }
    repoId = repo.id;
  }

  const [{ items }] = await db
    .select({ items: sql<number>`count(*)::int` })
    .from(repoListItems)
    .where(eq(repoListItems.listId, list.id));
  if (items >= MAX_ITEMS_PER_LIST) {
    return fail(`This list is full (${MAX_ITEMS_PER_LIST} repos).`, 422);
  }

  const [row] = await db
    .insert(repoListItems)
    .values({
      listId: list.id,
      repoId,
      addedByUserId: user.id,
      note: note || null,
    })
    .onConflictDoNothing()
    .returning({ id: repoListItems.id });
  if (!row) return fail("That repo is already in this list.", 409);

  revalidatePath(`/lists/${list.slug}`);
  return ok({ itemId: row.id }, { status: 201 });
}
