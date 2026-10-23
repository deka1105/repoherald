import { getFeed, type FeedFilters } from "@/lib/feed";
import { ok } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/**
 * The public feed, paginated by the same cursor the web uses.
 *
 * No auth: the feed is public on the web too, and requiring a token here would
 * mean the app couldn't show anything before sign-in — which is exactly the
 * "blank app until you log in" that App Store review treats as broken.
 *
 * The filters mirror the web's filter bar one for one. They are read off the
 * query string rather than a body so a filtered page stays a plain GET and
 * keeps the CDN caching below.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const filters: FeedFilters = {};
  const language = url.searchParams.get("language");
  const useCase = url.searchParams.get("useCase");
  const sector = url.searchParams.get("sector");
  const q = url.searchParams.get("q");
  if (language) filters.language = language;
  if (useCase) filters.useCase = useCase;
  if (sector) filters.sector = sector;
  if (q) filters.q = q;
  // A closed set, not a pass-through: `sort` is a union type, and forwarding
  // whatever the client sent would put an unchecked string into the query.
  if (url.searchParams.get("sort") === "donations") filters.sort = "donations";

  const { items, pinned, nextCursor, asOf } = await getFeed({ cursor, filters });

  return ok(
    { items, pinned, nextCursor, asOf },
    {
      headers: {
        // Same bucketing as the web feed, so a page served here and a page
        // served there agree.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
