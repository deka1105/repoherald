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
import { CreditNotifier } from "@/components/credit-notifier";

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
        (SELECT count(*) FROM users)::int AS user_count
    `),
    getActivePlans(),
    getFlag("sponsorshipsEnabled"),
    getFlag("landingStats"),
  ]);
  const stats = statsResult.rows[0] as unknown as {
    repo_count: number;
    stars_claimed: number;
    user_count: number;
  };

  return (
    <Landing
      stats={{
        repoCount: stats.repo_count,
        starsClaimed: stats.stars_claimed,
        userCount: displayUserCount(stats.user_count),
      }}
      // Unset means the landing omits the "send us what you saved" block
      // rather than pointing people at a handle nobody owns. Set
      // INGEST_INSTAGRAM to the account repoHeraldIG actually reads.
      instagramHandle={process.env.INGEST_INSTAGRAM?.trim().replace(/^@/, "") || null}
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
  );
}
