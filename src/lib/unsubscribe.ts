import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Unsubscribe links must work from an inbox, with no session and no login — a
 * recipient who cannot sign in must still be able to stop the mail. So the link
 * carries a signed token: the user id plus an HMAC over it, which proves the
 * link came from us without letting anyone unsubscribe a stranger by guessing
 * an id.
 *
 * Deliberately no expiry. An unsubscribe link that has expired is a broken
 * unsubscribe link, and people act on old mail.
 */
function secret(): string | null {
  return process.env.AUTH_SECRET?.trim() || null;
}

function sign(userId: string, key: string): string {
  return createHmac("sha256", key)
    .update(`unsubscribe:${userId}`)
    .digest("base64url");
}

export function unsubscribeToken(userId: string): string | null {
  const key = secret();
  return key ? `${userId}.${sign(userId, key)}` : null;
}

/** Returns the user id when the token is authentic, else null. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const provided = token.slice(dot + 1);

  const key = secret();
  if (!key) return null;
  const a = Buffer.from(sign(userId, key), "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? userId : null;
}

/**
 * Null when AUTH_SECRET is absent, so a misconfigured environment degrades to
 * "email without a one-click link" rather than silently sending no email at
 * all. The footer always names the wallet as the manual way to turn alerts off,
 * so there is still a working opt-out either way.
 */
export function unsubscribeUrl(userId: string): string | null {
  const token = unsubscribeToken(userId);
  if (!token) return null;
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://repoherald.com";
  return `${base}/unsubscribe?token=${encodeURIComponent(token)}`;
}
