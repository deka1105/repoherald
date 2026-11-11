import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { getActivePlans } from "@/lib/pricing";
import { displayUserCount } from "@/lib/stats";
import { getFlag } from "@/lib/settings";
import { FeedHome } from "@/components/feed-home";
import { Header } from "@/components/header";
import { UserCount } from "@/components/user-count";
import { Landing } from "@/components/landing-live";
import { ZeroToSalePixel } from "@/components/zero-to-sale-pixel";
import { CreditNotifier } from "@/components/credit-notifier";
import { JsonLd } from "@/components/json-ld";
import { websiteSchema } from "@/lib/schema";
import { FEED_ALTERNATE } from "@/lib/site";

const HOME_DESCRIPTION =
  "Post your repos, earn highlight time for the repos you star, and discover what's worth starring.";

export const metadata: Metadata = {
  // The root layout's bare "repoherald" is right for a tab but says nothing in
  // a search result, where this is the only line describing the site.
  title: "repoherald — post, discover and star GitHub repos",
  description: HOME_DESCRIPTION,
  // `types` is repeated from the root layout on purpose: Next replaces the
  // whole `alternates` object per segment rather than merging its fields, so
  // setting `canonical` here would otherwise drop the feed link.
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": FEED_ALTERNATE },
  },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" && v ? v : undefined;

  if (session?.user) {
    return (
      <>
        <Header />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:pb-14">
          <FeedHome
            cursor={one(params.cursor)}
            filters={{
              language: one(params.language),
              useCase: one(params.useCase),
              sector: one(params.sector),
              q: one(params.q),
              sort: one(params.sort) === "donations" ? "donations" : undefined,
            }}
          />
        </main>
        <UserCount />
        <CreditNotifier />
      </>
    );
  }

  const [statsResult, activePlans, sponsorships, showStats] = await Promise.all([
    db.execute(sql`
      SELECT
        (SELECT count(*) FROM repos WHERE status = 'active')::int AS repo_count,
        (SELECT count(*) FROM star_mints)::int AS stars_claimed,
        (SELECT count(*) FROM users)::int AS user_count,
        -- When this page's content last actually changed, which for a feed of
        -- listings means: when was the newest one listed.
        --
        -- Deliberately NOT max(last_synced_at). A resync re-fetches GitHub
        -- metadata on a schedule and stamps every row whether or not anything
        -- it returned differed, so including it makes dateModified advance
        -- every hour while the page is unchanged — the freshness equivalent of
        -- a uniform sitemap lastmod, which teaches a consumer to ignore the
        -- field. Individual repo pages are a different case and still use
        -- lastSyncedAt, the same value their sitemap entry carries.
        (
          SELECT max(created_at) FROM repos WHERE status = 'active'
        ) AS last_changed_at
    `),
    getActivePlans(),
    getFlag("sponsorshipsEnabled"),
    getFlag("landingStats"),
  ]);
  const stats = statsResult.rows[0] as unknown as {
    repo_count: number;
    stars_claimed: number;
    user_count: number;
    last_changed_at: string | Date | null;
  };

  // The driver hands timestamptz back as either a Date or a string depending on
  // the query path, and an empty table gives null. Anything unparseable has to
  // drop the claim rather than emit an Invalid Date.
  const lastChanged = stats.last_changed_at
    ? new Date(stats.last_changed_at)
    : null;
  const siteModified =
    lastChanged && !Number.isNaN(lastChanged.getTime()) ? lastChanged : null;

  return (
    <>
      {/* Organization lives in the root layout so every page carries it;
          this is the one page that states the site itself, because
          `dateModified` is the newest listing and only this route
          already pays for that query. */}
      <JsonLd data={websiteSchema(HOME_DESCRIPTION, siteModified)} />
      <Landing
        stats={{
          repoCount: stats.repo_count,
          starsClaimed: stats.stars_claimed,
          userCount: displayUserCount(stats.user_count),
        }}
        // Unset means the landing omits the "send us what you saved" block
        // rather than pointing people at a handle nobody owns. Set
        // INGEST_INSTAGRAM to the account repoHeraldIG actually reads.
        instagramHandle={
          process.env.INGEST_INSTAGRAM?.trim().replace(/^@/, "") || null
        }
        sponsorships={sponsorships}
        showStats={showStats}
        plans={activePlans.map((p) => ({
          key: p.key,
          durationDays: p.durationDays,
          starsCap: p.starsCap,
          amountCents: p.amountCents,
          discountPercent: p.discountPercent,
          currency: p.currency,
        }))}
      />
      <ZeroToSalePixel />
    </>
  );
}
