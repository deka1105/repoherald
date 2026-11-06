/**
 * The canonical origin, and the helpers that build absolute URLs from it.
 *
 * Deliberately not `server-only`: `metadataBase`, JSON-LD and the sitemap all
 * need it on the server, but a client component that wants to build a share
 * link needs the same value, and two sources of truth for "where does this site
 * live" is how canonical tags and `og:url` drift apart.
 *
 * Trailing slashes are stripped once, here, so every caller can join with a
 * leading-slash path and never produce `//`.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
  "https://repoherald.com";

export const SITE_NAME = "repoherald";

/** An absolute URL for a site-relative path. `abs("/repos/x")`. */
export function abs(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * For pages that must never appear in a search result: everything behind a
 * sign-in, the admin portal, and anything whose URL carries a token.
 *
 * `follow: false` as well as `index: false`, because the links on these pages
 * lead further into the same private area. Paired with the disallow list in
 * robots.ts — that stops crawling, this stops indexing of a URL a crawler
 * found somewhere else, which robots.txt alone does not.
 */
export const NOINDEX = { index: false, follow: false } as const;

/**
 * The RSS feed, as a metadata `alternates.types` value.
 *
 * Shared rather than written twice because Next replaces the whole
 * `alternates` object per route segment instead of merging its fields: any
 * page that sets its own `canonical` must restate this or silently lose the
 * feed link from its `<head>`.
 */
/**
 * The iOS app's public App Store page.
 *
 * Derived from a fact already in the repo rather than guessed: `ascAppId`
 * in `mobile/eas.json` is the App Store Connect id, and
 * `apps.apple.com/app/id<id>` is its canonical public form. Verified to
 * resolve 200 before being used as a schema claim.
 *
 * This is the first honest `sameAs` the site has had. Every other property
 * an SEO audit suggests for it — Wikipedia, Wikidata, Crunchbase, a social
 * profile — would point at a page that does not exist, which is why none of
 * them is here.
 */
export const APP_STORE_URL = "https://apps.apple.com/app/id6824936324";

export const FEED_PATH = "/feed.xml";
export const FEED_ALTERNATE = [
  { url: FEED_PATH, title: `${SITE_NAME} — newly listed repositories` },
];
