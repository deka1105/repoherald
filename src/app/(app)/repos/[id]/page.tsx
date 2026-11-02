import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { ExternalLink, Gift, Star, Zap } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  categories,
  highlights,
  repoCategories,
  repos,
  starMints,
  users,
} from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AddToList } from "@/components/add-to-list";
import { ClaimButton } from "@/components/claim-button";
import { Comments } from "@/components/comments";
import { DonateButton } from "@/components/donate-button";
import { LikeButton } from "@/components/like-button";
import { ReportButton } from "@/components/report-button";
import { ReportIssue } from "@/components/report-issue";
import { ShareRepo } from "@/components/share-repo";
import { ViewStats } from "@/components/view-stats";
import { getRepoViewStats } from "@/lib/view-stats";
import { timeAgo } from "@/lib/utils";
import {
  DAILY_MINT_CAP,
  ISSUE_REPORT_CREDITS,
  ISSUE_VALIDATION_DAYS,
  WEEKLY_MINT_CAP,
  getClaimUsage,
} from "@/lib/credits";
import { getComments, getLikeState } from "@/lib/social";
import { isUuid } from "@/lib/analytics";
import { abs, SITE_NAME } from "@/lib/site";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbs, repoSchema } from "@/lib/schema";

/**
 * A repo's own page is the only thing here a search engine should rank, so it
 * is the one page whose metadata is worth deriving rather than inheriting.
 *
 * A `hidden` repo gets noindex: it stays reachable for whoever holds the link,
 * but moderation hiding something while Google keeps serving it is the outcome
 * to avoid. `removed` 404s below, and a 404 needs no robots directive.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: `Repo — ${SITE_NAME}` };

  const repo = await db.query.repos.findFirst({ where: eq(repos.id, id) });
  if (!repo || repo.status === "removed") return { title: `Repo — ${SITE_NAME}` };

  const canonical = `/repos/${repo.id}`;
  const description =
    repo.description?.trim() ||
    `${repo.fullName} on ${SITE_NAME} — ${repo.starsCount.toLocaleString()} stars${
      repo.primaryLanguage ? `, written in ${repo.primaryLanguage}` : ""
    }.`;

  return {
    title: `${repo.fullName} — ${SITE_NAME}`,
    description,
    alternates: { canonical },
    robots: repo.status === "hidden" ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      title: repo.fullName,
      description,
      url: abs(canonical),
      siteName: SITE_NAME,
      ...(repo.avatarUrl ? { images: [{ url: repo.avatarUrl }] } : {}),
    },
    twitter: {
      card: "summary",
      title: repo.fullName,
      description,
      ...(repo.avatarUrl ? { images: [repo.avatarUrl] } : {}),
    },
  };
}

export default async function RepoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // `repos.id` is a uuid column, so comparing it against arbitrary text makes
  // Postgres raise rather than return no rows — which surfaced as a 500 on any
  // malformed URL. Crawlers and scanners generate those constantly, and
  // Googlebot slows its crawl of a whole origin in response to 5xx, so this
  // has to be a 404 before it is anything else.
  if (!isUuid(id)) notFound();
  const session = await auth();

  const repo = await db.query.repos.findFirst({ where: eq(repos.id, id) });
  if (!repo || repo.status === "removed") notFound();

  const claim =
    session?.user &&
    (await db.query.starMints.findFirst({
      where: and(
        eq(starMints.userId, session.user.id),
        eq(starMints.repoId, repo.id)
      ),
    }));
  const isOwn =
    session?.user &&
    (repo.postedByUserId === session.user.id ||
      repo.ownerLogin.toLowerCase() === session.user.githubLogin?.toLowerCase());

  const [poster, cats, [highlightStats], claimUsage, likes, comments, views] =
    await Promise.all([
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
      session?.user ? getClaimUsage(session.user.id) : null,
      getLikeState(repo.id, session?.user?.id),
      getComments(repo.id),
      getRepoViewStats(repo.id),
    ]);
  const fmtDuration = (mins: number) =>
    mins >= 60
      ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`
      : `${mins}m`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Hidden repos are noindex, so they get no markup inviting a crawler to
          describe them either. */}
      {repo.status === "active" && (
        <JsonLd
          data={[
            repoSchema(repo),
            breadcrumbs([
              { name: SITE_NAME, path: "/" },
              { name: repo.fullName, path: `/repos/${repo.id}` },
            ]),
          ]}
        />
      )}
      <div className="flex items-start gap-4">
        <Avatar className="size-12">
          <AvatarImage src={repo.avatarUrl ?? undefined} />
          <AvatarFallback>{repo.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{repo.fullName}</h1>
            {repo.isArchived && <Badge variant="outline">Archived</Badge>}
          </div>
          {repo.description && (
            <p className="mt-1 text-muted-foreground">{repo.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5" /> {repo.starsCount.toLocaleString()}
            </span>
            {repo.primaryLanguage && <span>{repo.primaryLanguage}</span>}
            {poster && (
              <span>
                posted by @{poster.githubLogin} · {timeAgo(repo.createdAt)}
              </span>
            )}
            <ViewStats stats={views} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Gift className="size-3.5" /> {highlightStats.donationCount}{" "}
              {highlightStats.donationCount === 1 ? "donation" : "donations"} received
            </span>
            <span className="inline-flex items-center gap-1">
              <Zap className="size-3.5" /> {fmtDuration(highlightStats.totalMinutes)}{" "}
              highlight time received
            </span>
          </div>
          {cats.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {cats.map((c) => (
                <Badge key={c.label} variant="outline" className="font-normal">
                  {c.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <a
            href={`https://github.com/${repo.fullName}`}
            target="_blank"
            rel="noreferrer"
          >
            View on GitHub <ExternalLink className="ml-1 size-3.5" />
          </a>
        </Button>
        {session?.user && !isOwn && (
          <ClaimButton repoId={repo.id} alreadyClaimed={Boolean(claim)} />
        )}
        {session?.user && <DonateButton repoId={repo.id} />}
        <LikeButton
          repoId={repo.id}
          liked={likes.liked}
          count={likes.count}
          signedIn={Boolean(session?.user)}
          className="h-9 rounded-md border px-3 text-sm"
        />
        <ShareRepo
          repoId={repo.id}
          fullName={repo.fullName}
          className="h-9 rounded-md border px-3 text-sm"
        />
        {session?.user && <ReportButton repoId={repo.id} />}
        {!session && (
          <p className="text-sm text-muted-foreground">
            Sign in to claim credit for starring this repo.
          </p>
        )}
      </div>
      {session?.user && !isOwn && (
        <ReportIssue
          repoId={repo.id}
          fullName={repo.fullName}
          credits={ISSUE_REPORT_CREDITS}
          validationDays={ISSUE_VALIDATION_DAYS}
        />
      )}
      {session?.user && <AddToList repoId={repo.id} userId={session.user.id} />}
      {claimUsage && (
        <p className="text-xs text-muted-foreground">
          Star claims used: {claimUsage.day}/{DAILY_MINT_CAP} today ·{" "}
          {claimUsage.week}/{WEEKLY_MINT_CAP} this week
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Star this repo on GitHub, then claim your credit here — 1 verified star
        earns 1 credit (1 hour of self-highlight, or donate 15 minutes to any repo).
        Unstarring within 100 days revokes the benefit.
      </p>
      <Comments
        repoId={repo.id}
        comments={comments}
        viewer={
          session?.user
            ? {
                id: session.user.id,
                isStaff:
                  session.user.role === "admin" ||
                  session.user.role === "moderator",
              }
            : null
        }
      />

      <Link href="/" className="inline-block text-sm text-muted-foreground hover:underline">
        ← Back to feed
      </Link>
    </div>
  );
}
