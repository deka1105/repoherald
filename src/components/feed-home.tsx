import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { getFeed, type FeedFilters } from "@/lib/feed";
import { RepoCard } from "@/components/repo-card";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";

export async function FeedHome({
  cursor,
  filters,
}: {
  cursor?: string;
  filters: FeedFilters;
}) {
  const [{ items, pinned, nextCursor }, cats, langRows] = await Promise.all([
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
  ]);
  const languages = (langRows.rows as unknown as { lang: string }[]).map(
    (r) => r.lang
  );

  const nextParams = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) nextParams.set(k, v);
  if (nextCursor) nextParams.set("cursor", nextCursor);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Discover repos</h1>
        <Button asChild size="sm">
          <Link href="/post">Post a repo</Link>
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
        <div className="space-y-3">
          {pinned.map((r) => (
            <RepoCard key={`pin-${r.id}`} repo={r} />
          ))}
        </div>
      )}
      {items.length === 0 && pinned.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No repos match. Try clearing filters, or post the first one.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((r, i) => (
            <RepoCard key={`${r.id}-${i}`} repo={r} />
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
