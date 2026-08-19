import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { repoComments, repoLikes, users } from "@/db/schema";

export const COMMENT_MAX = 1000;
export const COMMENTS_PER_DAY = 30;
export const COMMENT_PAGE_SIZE = 50;

export type RepoComment = {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  authorLogin: string;
  authorAvatarUrl: string | null;
};

/** Like count for a repo plus whether this viewer has liked it. */
export async function getLikeState(repoId: string, userId?: string) {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      liked: userId
        ? sql<boolean>`bool_or(${repoLikes.userId} = ${userId})`
        : sql<boolean>`false`,
    })
    .from(repoLikes)
    .where(eq(repoLikes.repoId, repoId));
  return { count: row?.count ?? 0, liked: Boolean(row?.liked) };
}

export async function getComments(repoId: string): Promise<RepoComment[]> {
  return db
    .select({
      id: repoComments.id,
      body: repoComments.body,
      createdAt: repoComments.createdAt,
      authorId: repoComments.userId,
      authorLogin: users.githubLogin,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(repoComments)
    .innerJoin(users, eq(repoComments.userId, users.id))
    .where(
      and(eq(repoComments.repoId, repoId), eq(repoComments.status, "visible"))
    )
    .orderBy(desc(repoComments.createdAt))
    .limit(COMMENT_PAGE_SIZE);
}
