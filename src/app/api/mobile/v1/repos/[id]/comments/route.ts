import { revalidatePath } from "next/cache";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { repoComments, repos } from "@/db/schema";
import { COMMENT_MAX, COMMENTS_PER_DAY, getComments } from "@/lib/social";
import { fail, jsonBody, mobileUser, notFound, ok, unauthenticated } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/** The visible comments on a listing. Public, as on the web. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await mobileUser(req);

  const comments = await getComments(id);
  return ok({
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      authorId: c.authorId,
      authorLogin: c.authorLogin,
      authorName: c.authorName,
      authorAvatarUrl: c.authorAvatarUrl,
      canDelete: Boolean(
        user && (c.authorId === user.id || user.role === "admin" || user.role === "moderator")
      ),
    })),
  });
}

/** Post a comment. Same length bounds and daily cap as the web action. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await mobileUser(req);
  if (!user) return unauthenticated();

  const body = await jsonBody(req);
  if (!body) return fail("Malformed body", 400);
  const text = typeof body.body === "string" ? body.body.trim() : "";

  if (text.length < 2) return fail("Say a little more than that.", 400);
  if (text.length > COMMENT_MAX) {
    return fail(`Comments are limited to ${COMMENT_MAX} characters.`, 400);
  }

  const repo = await db.query.repos.findFirst({ where: eq(repos.id, id) });
  if (!repo || repo.status === "removed") return notFound("Repo not found");

  // Same UTC-day window as the posting and claim caps. Admins exempt.
  if (user.role !== "admin") {
    const [{ today }] = await db
      .select({ today: sql<number>`count(*)::int` })
      .from(repoComments)
      .where(
        and(
          eq(repoComments.userId, user.id),
          gte(repoComments.createdAt, sql`date_trunc('day', now())`)
        )
      );
    if (today >= COMMENTS_PER_DAY) {
      return fail(`Daily comment limit reached (${COMMENTS_PER_DAY}/day).`, 429);
    }
  }

  const [inserted] = await db
    .insert(repoComments)
    .values({ repoId: id, userId: user.id, body: text })
    .returning({ id: repoComments.id, createdAt: repoComments.createdAt });

  revalidatePath(`/repos/${id}`);
  return ok({ id: inserted.id, createdAt: inserted.createdAt }, { status: 201 });
}
