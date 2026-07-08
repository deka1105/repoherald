import { sql } from "drizzle-orm";
import { db } from "@/db";

export const PAGE_SIZE = 20;
const AS_OF_BUCKET_MS = 5 * 60 * 1000;

export type FeedFilters = {
  language?: string;
  useCase?: string;
  sector?: string;
  q?: string;
  sort?: "donations";
};

export type FeedRepo = {
  id: string;
  fullName: string;
  description: string | null;
  primaryLanguage: string | null;
  starsCount: number;
  avatarUrl: string | null;
  isArchived: boolean;
  categoryLabels: string[];
  highlighted: boolean;
  sponsored: boolean;
  donationCount: number;
  score: number;
};

export type FeedCursor = { asOf: string; score: number; id: string };

export function encodeCursor(c: FeedCursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(raw: string | undefined): FeedCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof parsed.asOf !== "string" || typeof parsed.id !== "string") return null;
    return parsed as FeedCursor;
  } catch {
    return null;
  }
}

// Deterministic PRNG so the "random" sponsored slot is stable within an
// as_of bucket (no jumping cards on re-render or pagination).
function seededIndex(seed: string, mod: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % Math.max(mod, 1);
}

type ScoredRow = {
  id: string;
  full_name: string;
  description: string | null;
  primary_language: string | null;
  stars_count: number;
  avatar_url: string | null;
  is_archived: boolean;
  remaining_minutes: number;
  donation_count: number;
  score: number;
  sort_key: number;
  category_labels: string[] | null;
};

export async function getFeed(opts: {
  cursor?: string;
  filters?: FeedFilters;
}): Promise<{
  items: FeedRepo[];
  pinned: FeedRepo[];
  nextCursor: string | null;
  asOf: string;
}> {
  const cursor = decodeCursor(opts.cursor);
  const asOf = cursor
    ? new Date(cursor.asOf)
    : new Date(Math.floor(Date.now() / AS_OF_BUCKET_MS) * AS_OF_BUCKET_MS);
  const asOfIso = asOf.toISOString();
  const f = opts.filters ?? {};

  const filterConds = [sql`r.status = 'active'`];
  if (f.language) {
    filterConds.push(sql`r.languages @> ARRAY[${f.language}]::text[]`);
  }
  if (f.useCase) {
    filterConds.push(sql`EXISTS (
      SELECT 1 FROM repo_categories rc
      JOIN categories c ON c.id = rc.category_id
      WHERE rc.repo_id = r.id AND c.kind = 'use_case' AND c.slug = ${f.useCase}
    )`);
  }
  if (f.sector) {
    filterConds.push(sql`EXISTS (
      SELECT 1 FROM repo_categories rc
      JOIN categories c ON c.id = rc.category_id
      WHERE rc.repo_id = r.id AND c.kind = 'sector' AND c.slug = ${f.sector}
    )`);
  }
  if (f.q) {
    // Free-text search: repo name, owner/contributor login, description,
    // or category label.
    const like = `%${f.q}%`;
    filterConds.push(sql`(
      r.full_name ILIKE ${like}
      OR r.owner_login ILIKE ${like}
      OR r.description ILIKE ${like}
      OR EXISTS (
        SELECT 1 FROM repo_categories rc
        JOIN categories c ON c.id = rc.category_id
        WHERE rc.repo_id = r.id AND c.label ILIKE ${like}
      )
    )`);
  }
  const where = sql.join(filterConds, sql` AND `);

  const keyset = cursor
    ? sql`WHERE (s.sort_key, s.id) < (${cursor.score}, ${cursor.id}::uuid)`
    : sql``;

  // "donations" sort keys the page on donation count (score breaks ties);
  // default keys on the highlight-boosted score.
  const sortKeyExpr =
    f.sort === "donations"
      ? sql`(donation_count * 1000000.0 + score)`
      : sql`score`;

  const result = await db.execute(sql`
    WITH scored AS (
      SELECT
        r.id, r.full_name, r.description, r.primary_language, r.stars_count,
        r.avatar_url, r.is_archived,
        coalesce((
          SELECT extract(epoch FROM (h.ends_at - ${asOfIso}::timestamptz)) / 60.0
          FROM highlights h
          WHERE h.repo_id = r.id
            AND h.status != 'cancelled'
            AND h.starts_at <= ${asOfIso}::timestamptz
            AND h.ends_at > ${asOfIso}::timestamptz
          ORDER BY h.ends_at DESC
          LIMIT 1
        ), 0) AS remaining_minutes,
        (
          SELECT count(*) FROM highlights h
          WHERE h.repo_id = r.id AND h.source = 'donation' AND h.status != 'cancelled'
        )::int AS donation_count,
        (
          SELECT array_agg(c.label ORDER BY c.label)
          FROM repo_categories rc JOIN categories c ON c.id = rc.category_id
          WHERE rc.repo_id = r.id
        ) AS category_labels,
        ln(1 + r.stars_count)
          - extract(epoch FROM (${asOfIso}::timestamptz - r.created_at)) / 3600.0 / 48.0
          AS base_score
      FROM repos r
      WHERE ${where}
    ),
    final AS (
      SELECT *, (100.0 * remaining_minutes / 60.0 + base_score) AS score
      FROM scored
    ),
    keyed AS (
      SELECT *, ${sortKeyExpr} AS sort_key FROM final
    )
    SELECT * FROM keyed s
    ${keyset}
    ORDER BY s.sort_key DESC, s.id DESC
    LIMIT ${PAGE_SIZE + 1}
  `);

  const rows = result.rows as unknown as ScoredRow[];
  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);

  const items: FeedRepo[] = page.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    description: r.description,
    primaryLanguage: r.primary_language,
    starsCount: Number(r.stars_count),
    avatarUrl: r.avatar_url,
    isArchived: r.is_archived,
    categoryLabels: r.category_labels ?? [],
    highlighted: Number(r.remaining_minutes) > 0,
    sponsored: false,
    donationCount: Number(r.donation_count),
    score: Number(r.score),
  }));

  // The cursor pages on sort_key (score, or the donation-weighted key), so it
  // must carry sort_key — not score — or donations-sorted pages would skip rows.
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({ asOf: asOfIso, score: Number(last.sort_key), id: last.id })
      : null;

  // Sponsored placement is global (unfiltered): up to 2 pinned on top, plus
  // one card injected into the feed body at a bucket-stable position.
  const sponsoredResult = await db.execute(sql`
    SELECT r.id, r.full_name, r.description, r.primary_language, r.stars_count,
      r.avatar_url, r.is_archived, s.id AS sponsorship_id,
      (
        SELECT count(*) FROM highlights h
        WHERE h.repo_id = r.id AND h.source = 'donation' AND h.status != 'cancelled'
      )::int AS donation_count,
      (
        SELECT array_agg(c.label ORDER BY c.label)
        FROM repo_categories rc JOIN categories c ON c.id = rc.category_id
        WHERE rc.repo_id = r.id
      ) AS category_labels
    FROM sponsorships s
    JOIN repos r ON r.id = s.repo_id
    WHERE s.status = 'active'
      AND s.starts_at <= ${asOfIso}::timestamptz
      AND s.ends_at > ${asOfIso}::timestamptz
      AND (s.stars_cap IS NULL
        OR r.stars_count - coalesce(s.stars_at_start, 0) < s.stars_cap)
      AND r.status = 'active'
  `);
  const sponsoredRows = sponsoredResult.rows as unknown as (ScoredRow & {
    sponsorship_id: string;
  })[];

  const dayBucket = asOfIso.slice(0, 10);
  const toFeedRepo = (r: (typeof sponsoredRows)[number]): FeedRepo => ({
    id: r.id,
    fullName: r.full_name,
    description: r.description,
    primaryLanguage: r.primary_language,
    starsCount: Number(r.stars_count),
    avatarUrl: r.avatar_url,
    isArchived: r.is_archived,
    categoryLabels: r.category_labels ?? [],
    highlighted: false,
    sponsored: true,
    donationCount: Number(r.donation_count),
    score: 0,
  });

  const rotated = [...sponsoredRows].sort(
    (a, b) =>
      seededIndex(`${dayBucket}:${a.sponsorship_id}`, 10_000) -
      seededIndex(`${dayBucket}:${b.sponsorship_id}`, 10_000)
  );
  const pinned = rotated.slice(0, 2).map(toFeedRepo);
  const injectable = rotated[2];

  if (injectable && items.length > 2 && !cursor) {
    const pos =
      1 + seededIndex(`${asOfIso}:${injectable.sponsorship_id}`, items.length - 1);
    items.splice(pos, 0, toFeedRepo(injectable));
  }

  // Don't show the same repo twice when a pinned sponsor also ranks organically.
  const pinnedIds = new Set(pinned.map((p) => p.id));
  const deduped = items.filter((i) => i.sponsored || !pinnedIds.has(i.id));

  return { items: deduped, pinned, nextCursor, asOf: asOfIso };
}
