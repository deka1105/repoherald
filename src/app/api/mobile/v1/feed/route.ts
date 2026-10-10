import { NextResponse } from "next/server";
import { getFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";

/**
 * The public feed, paginated by the same cursor the web uses.
 *
 * No auth: the feed is public on the web too, and requiring a token here would
 * mean the app couldn't show anything before sign-in — which is exactly the
 * "blank app until you log in" that App Store review treats as broken.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const { items, pinned, nextCursor, asOf } = await getFeed({ cursor });

  return NextResponse.json(
    { version: 1, items, pinned, nextCursor, asOf },
    {
      headers: {
        // Same bucketing as the web feed, so a page served here and a page
        // served there agree.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
