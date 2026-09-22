import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { repos } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Compact digest of every listed repo, for the browser extension.
 *
 * WHY A DIGEST INSTEAD OF A LOOKUP-PER-PAGE: the obvious design is for the
 * extension to ask "is github.com/x/y listed?" on every GitHub page. That would
 * hand us a log of every repository each user browses — cross-site tracking,
 * and the exact thing /privacy promises we do not do. Instead the extension
 * downloads this list, caches it, and answers the question locally. We learn
 * nothing about where anyone browses.
 *
 * Only full names, which are already public on the feed. Nothing user-specific.
 */
export async function GET() {
  const rows = await db
    .select({ fullName: repos.fullName })
    .from(repos)
    .where(eq(repos.status, "active"))
    .orderBy(repos.fullName);

  // Lowercased: GitHub treats owner/name case-insensitively, so the extension
  // can compare without normalising every variant it sees in the URL bar.
  const names = rows.map((r) => r.fullName.toLowerCase());

  return NextResponse.json(
    { version: 1, count: names.length, repos: names },
    {
      headers: {
        // Public, non-personal data. `*` is safe here precisely because the
        // response is identical for everyone and carries no credentials.
        "Access-Control-Allow-Origin": "*",
        // Short CDN cache: new listings appear within a few minutes, and the
        // extension caches locally on top of this anyway.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
