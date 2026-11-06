import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { repos } from "@/db/schema";
import { abs, SITE_NAME, SITE_URL } from "@/lib/site";
import { rfc822, xmlText } from "@/lib/xml";

/**
 * RSS 2.0 feed of newly listed repositories.
 *
 * Two audiences, one file. People who follow releases in a reader get the
 * thing a discovery portal ought to have had from the start; AI answer engines
 * treat a dated feed as the site's freshness signal, which a sitemap `lastmod`
 * alone does not supply.
 *
 * RSS 2.0 rather than Atom purely for reach: every reader parses it, and the
 * fields this feed needs (title, link, guid, pubDate, description) are the ones
 * both formats agree on.
 *
 * Mirrors sitemap.ts deliberately: hourly revalidation, `status = "active"`
 * only, and a try/catch that degrades to an empty-but-valid channel. A feed
 * that 5xxes when the database blinks would both drop readers and slow
 * Googlebot's crawl of the whole origin.
 */

export const revalidate = 3600;

const FEED_LIMIT = 50;
const FEED_TITLE = `${SITE_NAME} — newly listed repositories`;
const FEED_DESCRIPTION =
  "GitHub repositories as they are posted to repoherald, newest first.";

export async function GET(): Promise<Response> {
  let items = "";
  let lastBuildDate = new Date();

  try {
    const rows = await db
      .select({
        id: repos.id,
        fullName: repos.fullName,
        description: repos.description,
        primaryLanguage: repos.primaryLanguage,
        createdAt: repos.createdAt,
      })
      .from(repos)
      .where(eq(repos.status, "active"))
      .orderBy(desc(repos.createdAt))
      .limit(FEED_LIMIT);

    // The newest listing, not the moment this file was generated: a
    // lastBuildDate that moves every hour while nothing is published tells a
    // reader to re-poll for content that isn't there.
    if (rows[0]) lastBuildDate = rows[0].createdAt;

    items = rows
      .map((row) => {
        const url = abs(`/repos/${row.id}`);
        // Language is appended rather than asserted as a separate element:
        // RSS has no field for it, and <category> is for taxonomy terms.
        const summary = [row.description?.trim(), row.primaryLanguage]
          .filter(Boolean)
          .join(" · ");
        return [
          "<item>",
          `<title>${xmlText(row.fullName)}</title>`,
          `<link>${xmlText(url)}</link>`,
          // isPermaLink="true" because the URL is the identity here, and it is
          // stable: repos.id is a uuid primary key.
          `<guid isPermaLink="true">${xmlText(url)}</guid>`,
          `<pubDate>${rfc822(row.createdAt)}</pubDate>`,
          summary ? `<description>${xmlText(summary)}</description>` : "",
          "</item>",
        ]
          .filter(Boolean)
          .join("");
      })
      .join("");
  } catch {
    // Same contract as the sitemap: an empty channel is a valid feed, a 500 is
    // not. Readers back off on error; they simply find nothing new here.
  }

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">' +
    "<channel>" +
    `<title>${xmlText(FEED_TITLE)}</title>` +
    `<link>${xmlText(SITE_URL)}</link>` +
    `<description>${xmlText(FEED_DESCRIPTION)}</description>` +
    "<language>en</language>" +
    `<lastBuildDate>${rfc822(lastBuildDate)}</lastBuildDate>` +
    `<atom:link href="${xmlText(abs("/feed.xml"))}" rel="self" type="application/rss+xml"/>` +
    items +
    "</channel>" +
    "</rss>";

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Matches `revalidate`, and lets a reader's conditional poll be cheap.
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
