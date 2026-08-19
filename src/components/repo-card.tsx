import Link from "next/link";
import { Gift, Heart, MessageCircle, Star } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShareRepo } from "@/components/share-repo";

export type RepoCardData = {
  id: string;
  fullName: string;
  description: string | null;
  primaryLanguage: string | null;
  starsCount: number;
  avatarUrl: string | null;
  isArchived: boolean;
  categoryLabels?: string[];
  highlighted?: boolean;
  sponsored?: boolean;
  donationCount?: number;
  postedByLogin?: string | null;
  postedAt?: string;
  likeCount?: number;
  commentCount?: number;
};

/** Engagement counts. These are read-only on cards — liking and commenting
 * both happen on the repo page, so a card never needs a session. */
function Engagement({ repo, size }: { repo: RepoCardData; size: "sm" | "xs" }) {
  // Callers that don't count (list pages) omit both, and showing them a hard
  // "0 likes" would be a lie rather than a blank.
  if (repo.likeCount === undefined && repo.commentCount === undefined) return null;
  const icon = size === "xs" ? "size-3" : "size-3.5";
  return (
    <Link
      href={`/repos/${repo.id}`}
      className="inline-flex items-center gap-2 hover:text-foreground"
    >
      <span className="inline-flex items-center gap-1">
        <Heart className={icon} aria-hidden /> {(repo.likeCount ?? 0).toLocaleString()}
        <span className="sr-only">likes</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <MessageCircle className={icon} aria-hidden />{" "}
        {(repo.commentCount ?? 0).toLocaleString()}
        <span className="sr-only">comments</span>
      </span>
    </Link>
  );
}

export type RepoCardVariant = "banner" | "tile";

const featuredClass =
  "border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/10";

/** "@poster · 3h" — who put this in the feed and how fresh it is. */
function Byline({
  repo,
  className,
}: {
  repo: RepoCardData;
  className?: string;
}) {
  if (!repo.postedByLogin && !repo.postedAt) return null;
  return (
    <p className={cn("text-muted-foreground", className)}>
      {repo.postedByLogin && <span>@{repo.postedByLogin}</span>}
      {repo.postedByLogin && repo.postedAt && <span aria-hidden> · </span>}
      {repo.postedAt && <span>{timeAgo(repo.postedAt)}</span>}
    </p>
  );
}

/** Compact square tile used by the "tiles" and "hybrid" feed layouts. */
function TileCard({ repo }: { repo: RepoCardData }) {
  const featured = Boolean(repo.highlighted || repo.sponsored);
  return (
    <Card
      className={cn(
        "h-full transition-colors hover:border-foreground/20",
        featured && featuredClass
      )}
    >
      <CardContent className="flex h-full flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <Avatar className="size-7 shrink-0">
            <AvatarImage src={repo.avatarUrl ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {repo.fullName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Link
              href={`/repos/${repo.id}`}
              className="block truncate text-sm font-medium hover:underline"
            >
              {repo.fullName}
            </Link>
            <Byline repo={repo} className="truncate text-[11px]" />
          </div>
        </div>
        {repo.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {repo.description}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3" /> {repo.starsCount.toLocaleString()}
          </span>
          {repo.primaryLanguage && <span>{repo.primaryLanguage}</span>}
          {repo.sponsored && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              Sponsored
            </Badge>
          )}
          {repo.highlighted && !repo.sponsored && (
            <Badge className="bg-amber-500 px-1.5 py-0 text-[10px] text-white hover:bg-amber-500">
              Highlighted
            </Badge>
          )}
          <Engagement repo={repo} size="xs" />
          <ShareRepo
            repoId={repo.id}
            fullName={repo.fullName}
            className="ml-auto text-[11px]"
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** Full-width post-style card — the default feed card. */
function BannerCard({ repo }: { repo: RepoCardData }) {
  const featured = Boolean(repo.highlighted || repo.sponsored);
  return (
    <Card
      className={cn(
        "transition-colors hover:border-foreground/20",
        featured && featuredClass
      )}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <Avatar className="mt-0.5 size-9">
          <AvatarImage src={repo.avatarUrl ?? undefined} />
          <AvatarFallback>{repo.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/repos/${repo.id}`}
              className="truncate font-medium hover:underline"
            >
              {repo.fullName}
            </Link>
            {repo.sponsored && <Badge variant="secondary">Sponsored</Badge>}
            {repo.highlighted && !repo.sponsored && (
              <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                Highlighted
              </Badge>
            )}
            {repo.isArchived && <Badge variant="outline">Archived</Badge>}
          </div>
          <Byline repo={repo} className="mt-0.5 text-xs" />
          {repo.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {repo.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3" /> {repo.starsCount.toLocaleString()}
            </span>
            {(repo.donationCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <Gift className="size-3" /> {repo.donationCount!.toLocaleString()}{" "}
                {repo.donationCount === 1 ? "donation" : "donations"}
              </span>
            )}
            {repo.primaryLanguage && <span>{repo.primaryLanguage}</span>}
            {repo.categoryLabels?.map((label) => (
              <Badge key={label} variant="outline" className="font-normal">
                {label}
              </Badge>
            ))}
            <Engagement repo={repo} size="sm" />
            <ShareRepo
              repoId={repo.id}
              fullName={repo.fullName}
              className="ml-auto"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RepoCard({
  repo,
  variant = "banner",
}: {
  repo: RepoCardData;
  variant?: RepoCardVariant;
}) {
  return variant === "tile" ? (
    <TileCard repo={repo} />
  ) : (
    <BannerCard repo={repo} />
  );
}
