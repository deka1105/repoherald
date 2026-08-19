import Link from "next/link";
import { cookies } from "next/headers";
import { asc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { categories } from "@/db/schema";
import { getFeed, type FeedFilters } from "@/lib/feed";
import {
  FEED_LAYOUT_COOKIE,
  parseFeedLayout,
  type FeedLayout,
} from "@/lib/feed-layout";
import { RepoCard, type RepoCardVariant } from "@/components/repo-card";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";

const TILE_GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3";
const STACK = "space-y-3";

function sectionClass(variant: RepoCardVariant) {
  return variant === "tile" ? TILE_GRID : STACK;
}

// banners → all banners; tiles → all tiles; hybrid → sponsored banners, rest tiles.
function variantsFor(layout: FeedLayout): {
  pinned: RepoCardVariant;
  items: RepoCardVariant;
} {
  return {
    pinned: layout === "tiles" ? "tile" : "banner",
    items: layout === "banners" ? "banner" : "tile",
  };
}

export async function FeedHome({
  cursor,
  filters,
}: {
  cursor?: string;
  filters: FeedFilters;
}) {
  const [{ items, pinned, nextCursor }, cats, langRows, cookieStore, session] =
    await Promise.all([
      getFeed({ cursor, filters }),
      db
        .select()
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.label)),
      db.execute(sql`
        SELECT DISTINCT unnest(languages) AS lang FROM repos
        WHERE status = 'active' ORDER BY lang LIMIT 50
      `),
      cookies(),
      auth(),
    ]);
  const languages = (langRows.rows as unknown as { lang: string }[]).map(
    (r) => r.lang
  );

  const layout = parseFeedLayout(cookieStore.get(FEED_LAYOUT_COOKIE)?.value);
  const variant = variantsFor(layout);

  const nextParams = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) nextParams.set(k, v);
  if (nextCursor) nextParams.set("cursor", nextCursor);

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Your feed</h1>
      {/* Compose row: the feed opens with an invitation to post, not a page
          title. FeedHome only renders for signed-in users, so there is always
          someone to greet. */}
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <Avatar className="size-9 shrink-0">
          <AvatarImage src={session?.user?.image ?? undefined} />
          <AvatarFallback>
            {(session?.user?.githubLogin ?? "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <Link
          href="/post"
          className="min-w-0 flex-1 truncate rounded-full border bg-muted/40 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Share a repo worth starring
          {session?.user?.githubLogin ? `, @${session.user.githubLogin}` : ""}…
        </Link>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/post">Post</Link>
        </Button>
      </div>
      <FilterBar
        languages={languages}
        useCases={cats
          .filter((c) => c.kind === "use_case")
          .map((c) => ({ value: c.slug, label: c.label }))}
        sectors={cats
          .filter((c) => c.kind === "sector")
          .map((c) => ({ value: c.slug, label: c.label }))}
      />
      {pinned.length > 0 && (
        <div className={sectionClass(variant.pinned)}>
          {pinned.map((r) => (
            <RepoCard key={`pin-${r.id}`} repo={r} variant={variant.pinned} />
          ))}
        </div>
      )}
      {items.length === 0 && pinned.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No repos match. Try clearing filters, or post the first one.
        </p>
      ) : (
        <div className={sectionClass(variant.items)}>
          {items.map((r, i) => (
            <RepoCard key={`${r.id}-${i}`} repo={r} variant={variant.items} />
          ))}
        </div>
      )}
      {nextCursor && (
        <div className="flex justify-center pt-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/?${nextParams.toString()}`}>Load more</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
