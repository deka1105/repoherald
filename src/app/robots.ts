import type { MetadataRoute } from "next";
import { abs } from "@/lib/site";

/**
 * robots.txt.
 *
 * Everything disallowed below is disallowed because it is either behind a
 * sign-in, destructive to the index, or carries a secret in the URL — not to
 * hide anything. In particular:
 *
 * - `/lists/` is excluded on purpose. List slugs carry a random suffix so
 *   lists are not enumerable, and `visibility` only ever reads "unlisted" or
 *   "private" — there is no public value. An owner who shares a link has not
 *   asked to be indexed, so advertising those URLs to a crawler would quietly
 *   convert "shareable" into "published". The page metadata carries a matching
 *   `noindex`, because robots.txt stops crawling, not indexing of a URL
 *   discovered elsewhere.
 * - `/unsubscribe` holds a signed per-recipient token. A crawler fetching one
 *   would be acting on a link meant for one person.
 * - `/search` is excluded to keep query-string permutations out of the index.
 *
 * AI crawlers are deliberately NOT blocked. This site publishes an MCP server
 * and a plugin, so being readable by agents is part of what it is for, and
 * blocking a search-citation crawler removes the site from that engine's
 * answers. If the operator would rather not feed model *training* while
 * keeping AI-search citability, the bots to disallow are GPTBot, ClaudeBot,
 * Bytespider, CCBot and Google-Extended — none of which affects Googlebot,
 * OAI-SearchBot or Claude-SearchBot.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/account",
          "/wallet",
          "/credits",
          "/post",
          "/promote",
          "/lists",
          "/search",
          "/unsubscribe",
          "/email-preview",
        ],
      },
    ],
    // No `host`: that directive was Yandex-only, expects a bare hostname
    // rather than a URL, and Yandex itself dropped it in 2018. Emitting it
    // would be a malformed line for no consumer.
    sitemap: abs("/sitemap.xml"),
  };
}
