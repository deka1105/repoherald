import { abs, SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * JSON-LD builders.
 *
 * Pure and dependency-light on purpose: identity is passed in rather than read
 * from `@/lib/legal` (which is `server-only`), so these can be unit-tested with
 * no DOM, no database and no env.
 *
 * Only types Google still produces results for are built here. Nothing in this
 * file asserts a fact the database does not hold — a schema block is a claim
 * made to a search engine in machine-readable form, and an invented one is
 * worse than an absent one for the same reason an invented company address is.
 */

export type JsonLdObject = Record<string, unknown>;

/**
 * The site itself. No `potentialAction`/SearchAction: Google retired the
 * sitelinks searchbox, so it would be markup nothing consumes.
 *
 * `dateModified` is emitted only when a real one is supplied. For this site
 * that is the newest active listing, which is genuinely when the front page's
 * content last changed — not the moment the page was rendered. A timestamp
 * that advances on every request is the freshness equivalent of a uniform
 * sitemap `lastmod`: it tells a consumer the field carries no information.
 */
export function websiteSchema(
  description: string,
  dateModified?: Date | null,
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description,
    ...(dateModified ? { dateModified: dateModified.toISOString() } : {}),
  };
}

/**
 * The publisher.
 *
 * `name` is the brand, which is a fact already recorded in the codebase.
 * `legalName` is only emitted when LEGAL_ENTITY_NAME is configured — the same
 * rule the policy pages follow, for the same reason: naming a legal entity we
 * have not been told about would be a false statement about a real company.
 *
 * `sameAs` follows that rule too, and it is the property an audit will keep
 * asking for: it takes only URLs that actually resolve to a page about this
 * entity. An invented Wikidata or Crunchbase link is a machine-readable
 * claim to own a page that is not ours, so an empty list omits the property
 * rather than filling it.
 */
export function organizationSchema(opts: {
  entityName?: string | null;
  logoPath?: string | null;
  sameAs?: readonly string[] | null;
}): JsonLdObject {
  const { entityName, logoPath, sameAs } = opts;
  const profiles = (sameAs ?? []).map((u) => u.trim()).filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    ...(entityName ? { legalName: entityName } : {}),
    ...(logoPath ? { logo: abs(logoPath) } : {}),
    ...(profiles.length ? { sameAs: profiles } : {}),
  };
}

/**
 * A posted repository, as SoftwareSourceCode.
 *
 * `author` is deliberately absent. schema.org wants a Person or an
 * Organization and the `repos` table does not record which a GitHub owner is,
 * so either choice would be a guess stated as fact; `codeRepository` points at
 * GitHub, where the real owner is unambiguous. Star counts are likewise not
 * expressed as an aggregateRating — stars are not ratings, and dressing them up
 * as one is the kind of thing that earns a structured-data manual action.
 */
export function repoSchema(repo: {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  primaryLanguage: string | null;
  createdAt?: Date | null;
  lastSyncedAt?: Date | null;
}): JsonLdObject {
  const modified = repo.lastSyncedAt ?? repo.createdAt;
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: repo.name,
    url: abs(`/repos/${repo.id}`),
    codeRepository: `https://github.com/${repo.fullName}`,
    ...(repo.description?.trim()
      ? { description: repo.description.trim() }
      : {}),
    ...(repo.primaryLanguage
      ? { programmingLanguage: repo.primaryLanguage }
      : {}),
    // Both dates are columns, not guesses: `createdAt` is when the listing was
    // posted here, and `lastSyncedAt` is when its GitHub metadata was last
    // refreshed — the same value the sitemap uses as `lastmod`, for the same
    // reason. Falling back to `createdAt` keeps dateModified >= datePublished.
    ...(repo.createdAt
      ? { datePublished: repo.createdAt.toISOString() }
      : {}),
    ...(modified ? { dateModified: modified.toISOString() } : {}),
  };
}

/**
 * A page of questions and answers, as FAQPage.
 *
 * Marks up questions that are already on the page and visible to a reader —
 * never a set written to produce the markup. Google retired FAQ rich results
 * in May 2026, so this earns nothing in a search result; it is here because
 * answer engines still parse FAQPage to lift a direct answer, and the content
 * exists either way. If the visible list is ever removed, remove this with it.
 */
export function faqSchema(
  items: readonly { q: string; a: string }[],
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/** A breadcrumb trail. Paths are site-relative; positions are 1-based. */
export function breadcrumbs(
  items: readonly { name: string; path: string }[],
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}

/**
 * Serialise JSON-LD for embedding in a `<script type="application/ld+json">`.
 *
 * `JSON.stringify` is almost enough, with one exception that matters here: a
 * `<` inside a string value would let a crafted value close the script element
 * early and inject markup. Repo names and descriptions come from GitHub, so
 * that input is not ours to trust. `<` is valid JSON and parses back to
 * the same string, so escaping it costs nothing and removes the hazard.
 */
export function serializeJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
