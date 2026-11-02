import type { MetadataRoute } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { repos } from "@/db/schema";
import { abs } from "@/lib/site";

/**
 * sitemap.xml.
 *
 * Regenerated hourly rather than at build time, because the useful half of it
 * is rows in the database and a sitemap pinned to the last deploy is a sitemap
 * that stops announcing new listings.
 *
 * No `priority` and no `changefreq`: Google ignores both, and emitting them
 * invites the belief that they are doing something.
 *
 * `lastmod` is the honest value or nothing. For a repo it is `lastSyncedAt`,
 * the moment its GitHub metadata was last refreshed, which is genuinely when
 * the page's content last changed, falling back to when it was posted. The
 * static pages below carry no `lastmod` at all rather than `new Date()` —
 * stamping every entry with the build time is the "suspiciously uniform"
 * pattern that teaches Google to disregard the field for the whole site.
 *
 * Deliberately absent: repo lists. See the note in robots.ts — no list is
 * public, so none of them belongs in a file whose purpose is enumeration.
 */

export const revalidate = 3600;

/** Public, crawlable, and worth a search result. */
const STATIC_PATHS = [
  "/",
  "/identify",
  "/support",
  "/privacy",
  "/terms",
  "/cookies",
  "/refunds",
] as const;

// Google's per-file ceiling is 50,000 URLs. Well clear of it today, but a
// sitemap that silently truncates is better than one that is rejected whole.
const REPO_LIMIT = 45_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: abs(path),
  }));

  let repoEntries: MetadataRoute.Sitemap = [];
  try {
    const rows = await db
      .select({
        id: repos.id,
        lastSyncedAt: repos.lastSyncedAt,
        createdAt: repos.createdAt,
      })
      .from(repos)
      .where(eq(repos.status, "active"))
      .orderBy(desc(repos.createdAt))
      .limit(REPO_LIMIT);

    repoEntries = rows.map((row) => ({
      url: abs(`/repos/${row.id}`),
      lastModified: row.lastSyncedAt ?? row.createdAt,
    }));
  } catch {
    // A database that is briefly unreachable must not take the sitemap with
    // it. Serving the static section is a valid, if smaller, sitemap; failing
    // the request would hand Googlebot a 5xx and slow its crawl of everything.
  }

  return [...staticEntries, ...repoEntries];
}
