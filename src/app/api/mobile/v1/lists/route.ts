import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { repoLists } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import {
  DESCRIPTION_MAX,
  MAX_LISTS_PER_USER,
  TITLE_MAX,
  getUserLists,
  newSlug,
} from "@/lib/lists";
import { fail, jsonBody, mobileUser, ok, unauthenticated } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/** The caller's own lists, newest first, with live item counts. */
export async function GET(req: Request) {
  const user = await mobileUser(req);
  if (!user) return unauthenticated();

  const rows = await getUserLists(user.id);
  return ok({
    lists: rows.map(({ list, itemCount }) => ({
      id: list.id,
      slug: list.slug,
      title: list.title,
      description: list.description,
      contributions: list.contributions,
      visibility: list.visibility,
      // Platform lists (instagram/tiktok) are where ingested repos are filed;
      // the app labels them rather than pretending the user made them.
      source: list.source,
      createdAt: list.createdAt,
      itemCount,
    })),
    limits: { maxLists: MAX_LISTS_PER_USER, titleMax: TITLE_MAX, descriptionMax: DESCRIPTION_MAX },
  });
}

/** Create a list. Same bounds and per-user cap as the web form. */
export async function POST(req: Request) {
  const user = await mobileUser(req);
  if (!user) return unauthenticated();

  const body = await jsonBody(req);
  if (!body) return fail("Malformed body", 400);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  if (title.length < 3 || title.length > TITLE_MAX) {
    return fail(`Give the list a name of 3–${TITLE_MAX} characters.`, 400);
  }
  if (description.length > DESCRIPTION_MAX) {
    return fail(`Description must be under ${DESCRIPTION_MAX} characters.`, 400);
  }

  const [{ owned }] = await db
    .select({ owned: sql<number>`count(*)::int` })
    .from(repoLists)
    .where(and(eq(repoLists.ownerUserId, user.id), eq(repoLists.status, "active")));
  if (owned >= MAX_LISTS_PER_USER && user.role !== "admin") {
    return fail(`You've reached the limit of ${MAX_LISTS_PER_USER} lists.`, 422);
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
    metadata: { title, source: "mobile" },
  });

  revalidatePath("/lists");
  return ok({ id: list.id, slug: list.slug }, { status: 201 });
}
