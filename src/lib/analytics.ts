import "server-only";
import { createHash } from "node:crypto";

export const ANALYTICS_EVENT_TYPES = [
  "page_view",
  "repo_view",
  "claim_click",
  "donate_click",
  "github_click",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export function isAnalyticsEventType(v: unknown): v is AnalyticsEventType {
  return (
    typeof v === "string" &&
    (ANALYTICS_EVENT_TYPES as readonly string[]).includes(v)
  );
}

const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|slackbot|vkshare|whatsapp|telegram|discord|preview|lighthouse|headless|phantom|puppeteer|playwright|monitor|uptime|curl|wget|python-requests|axios|go-http|node-fetch/i;

export function isBot(ua: string | null | undefined): boolean {
  return !ua || BOT_RE.test(ua);
}

/**
 * Cookieless visitor id: a daily-rotating salted hash of IP + user-agent. No
 * cookie, no stored PII — good enough for unique-visitor counts within a day
 * (returning visitors across days count separately; that's the tradeoff).
 */
export function visitorHash(ip: string, ua: string): string {
  const salt =
    process.env.ANALYTICS_SALT ?? process.env.AUTH_SECRET ?? "repoherald-analytics";
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${salt}|${day}|${ip}|${ua}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Visitor country, from the hosting edge's own geo lookup.
 *
 * Country only. The edge also offers region, city, latitude and longitude; we
 * take none of them, because "which countries read this" is the question
 * listing authors actually ask, and a city plus a timestamp against ~100
 * visitors a month is close enough to a name to be worth not holding.
 *
 * The IP is still never stored — this resolves to a two-letter code before it
 * reaches us, so there is nothing to hash or discard.
 *
 * Validated rather than trusted. On Vercel this header is set by the platform
 * and overwrites anything a client sends, but the same code runs behind
 * `next dev` and could run behind another proxy, and an unvalidated header
 * would mean an arbitrary 512-byte string per event with a visitor choosing it.
 * `ZZ` is what the edge returns when it cannot place an address; it is dropped
 * so "unknown" reads as one thing in the data, not two.
 */
export function requestCountry(
  headers: Pick<Headers, "get">
): string | null {
  const raw = headers.get("x-vercel-ip-country");
  if (!raw || !/^[A-Za-z]{2}$/.test(raw)) return null;
  const code = raw.toUpperCase();
  return code === "ZZ" ? null : code;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

const REPO_PATH_RE = /^\/repos\/([^/?#]+)$/;

/** Pull a repo id out of a /repos/{uuid} path, so repo-detail page views can be
 * recorded as repo_view without instrumenting the (root-owned) detail page. */
export function repoIdFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const m = REPO_PATH_RE.exec(path);
  return m && isUuid(m[1]) ? m[1] : null;
}

/** Referrer hostname only (drop path/query), and null out same-site referrers. */
export function referrerHost(
  referrer: string | null | undefined,
  selfHost: string | null | undefined
): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname;
    if (!host) return null;
    if (selfHost && host === selfHost.split(":")[0]) return null;
    return host.slice(0, 255);
  } catch {
    return null;
  }
}
