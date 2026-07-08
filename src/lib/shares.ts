export const PLATFORM_DOMAINS: Record<string, string[]> = {
  reddit: ["reddit.com", "redd.it"],
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com"],
  x: ["x.com", "twitter.com"],
  tiktok: ["tiktok.com"],
};

export const PLATFORM_LABELS: Record<string, string> = {
  reddit: "Reddit",
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X (Twitter)",
  tiktok: "TikTok",
};

/** Lowercase host (www stripped) + path without trailing slash; query dropped
 * so tracking params can't be used to sneak in duplicates. */
export function normalizeShareUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return null;
  }
}
