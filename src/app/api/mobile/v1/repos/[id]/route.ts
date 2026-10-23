import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  highlights,
  repoCategories,
  repos,
  starMints,
  users,
} from "@/db/schema";
import { getComments, getLikeState } from "@/lib/social";
import { getRepoViewStats } from "@/lib/view-stats";
import { getListsMissingRepo } from "@/lib/lists";
import {
  DAILY_MINT_CAP,
  ISSUE_REPORT_CREDITS,
  WEEKLY_MINT_CAP,
  getClaimUsage,
} from "@/lib/credits";
import { mobileUser, notFound, ok } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/**
 * Everything the repo screen draws, in one round trip.
 *
 * Deliberately one request rather than six: on a phone each extra call is a
 * fresh TLS handshake on a cold radio, and the screen cannot render usefully
 * until the slowest of them lands anyway. The signed-out shape is the same
 * minus the `viewer` block, so the client has no second layout to maintain.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await mobileUser(req);

  const repo = await db.query.repos.findFirst({ where: eq(repos.id, id) });
  // `hidden` is reachable here on purpose — a repo filed from a DM is hidden
  // from the public feed but must still open for the person holding the link.
  // `removed` is a moderation decision and 404s for everyone.
  if (!repo || repo.status === "removed") return notFound("Repo not found");

  const [poster, cats, [highlightStats], likes, comments, views] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, repo.postedByUserId) }),
    db
      .select({ label: categories.label, kind: categories.kind })
      .from(repoCategories)
      .innerJoin(categories, eq(repoCategories.categoryId, categories.id))
      .where(eq(repoCategories.repoId, repo.id)),
    db
      .select({
        donationCount: sql<number>`count(*) FILTER (WHERE source = 'donation' AND status != 'cancelled')::int`,
        totalMinutes: sql<number>`coalesce(sum(minutes_total) FILTER (WHERE status != 'cancelled'), 0)::int`,
      })
      .from(highlights)
      .where(eq(highlights.repoId, repo.id)),
    getLikeState(repo.id, user?.id),
    getComments(repo.id),
    getRepoViewStats(repo.id),
  ]);

  // Only fetched for a signed-in caller, and only after the repo is known to
  // exist — three more queries for an anonymous reader would be wasted work.
  const viewer = user
    ? await (async () => {
        const [claim, claimUsage, lists] = await Promise.all([
          db.query.starMints.findFirst({
            where: and(eq(starMints.userId, user.id), eq(starMints.repoId, repo.id)),
          }),
          getClaimUsage(user.id),
          getListsMissingRepo(user.id, repo.id),
        ]);
        return {
          signedIn: true as const,
          liked: likes.liked,
          alreadyClaimed: Boolean(claim),
          // Claiming your own listing is refused server-side; the app hides
          // the button rather than letting someone tap into a known error.
          isOwn:
            repo.postedByUserId === user.id ||
            repo.ownerLogin.toLowerCase() === (user.githubLogin ?? "").toLowerCase(),
          claimsToday: claimUsage.day,
          claimsThisWeek: claimUsage.week,
          listsMissingRepo: lists,
        };
      })()
    : null;

  return ok({
    repo: {
      id: repo.id,
      fullName: repo.fullName,
      ownerLogin: repo.ownerLogin,
      name: repo.name,
      description: repo.description,
      primaryLanguage: repo.primaryLanguage,
      languages: repo.languages,
      starsCount: repo.starsCount,
      avatarUrl: repo.avatarUrl,
      isArchived: repo.isArchived,
      createdAt: repo.createdAt,
      postedByLogin: poster?.githubLogin ?? null,
      categoryLabels: cats.map((c) => c.label),
      donationCount: highlightStats.donationCount,
      highlightMinutes: highlightStats.totalMinutes,
      views: views.views,
      visitors: views.visitors,
    },
    likeCount: likes.count,
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      authorId: c.authorId,
      authorLogin: c.authorLogin,
      authorName: c.authorName,
      authorAvatarUrl: c.authorAvatarUrl,
      // So the app can show Delete without re-deriving ownership from ids it
      // would otherwise have no reason to hold.
      canDelete: Boolean(
        user && (c.authorId === user.id || user.role === "admin" || user.role === "moderator")
      ),
    })),
    viewer,
    limits: {
      dailyMintCap: DAILY_MINT_CAP,
      weeklyMintCap: WEEKLY_MINT_CAP,
      issueReportCredits: ISSUE_REPORT_CREDITS,
    },
  });
}
