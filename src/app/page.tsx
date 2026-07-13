import { sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { getFeed, type FeedRepo } from "@/lib/feed";
import { getActivePlans } from "@/lib/pricing";
import { FeedHome } from "@/components/feed-home";
import { Header } from "@/components/header";
import { UserCount } from "@/components/user-count";
import { Landing, type LandingCard } from "@/components/landing-live";
import { CreditNotifier } from "@/components/credit-notifier";

function fmtStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function toCard(r: FeedRepo): LandingCard {
  return {
    id: r.id,
    fullName: r.fullName,
    description: r.description,
    chips: [
      ...(r.primaryLanguage ? [r.primaryLanguage] : []),
      ...r.categoryLabels.slice(0, 2),
    ].slice(0, 3),
    stars: fmtStars(r.starsCount),
    sponsored: r.sponsored,
    highlighted: r.highlighted,
  };
}

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
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:pb-14">
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

  const [{ items, pinned }, statsResult, activePlans] = await Promise.all([
    getFeed({}),
    db.execute(sql`
      SELECT
        (SELECT count(*) FROM repos WHERE status = 'active')::int AS repo_count,
        (SELECT count(*) FROM star_mints)::int AS stars_claimed,
        (SELECT count(*) FROM users)::int AS user_count
    `),
    getActivePlans(),
  ]);
  const stats = statsResult.rows[0] as unknown as {
    repo_count: number;
    stars_claimed: number;
    user_count: number;
  };

  const cards = [...pinned, ...items.filter((i) => !i.sponsored)]
    .slice(0, 3)
    .map(toCard);

  return (
    <Landing
      stats={{
        repoCount: stats.repo_count,
        starsClaimed: stats.stars_claimed,
        userCount: stats.user_count,
      }}
      cards={cards}
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
