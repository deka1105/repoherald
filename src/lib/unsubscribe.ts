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
function secret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.ANALYTICS_SALT;
  if (!s) throw new Error("AUTH_SECRET is required to sign unsubscribe links");
  return s;
}

function sign(userId: string): string {
  return createHmac("sha256", secret())
    .update(`unsubscribe:${userId}`)
    .digest("base64url");
}

export function unsubscribeToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

/** Returns the user id when the token is authentic, else null. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const provided = token.slice(dot + 1);

  let expected: string;
  try {
    expected = sign(userId);
  } catch {
    return null;
  }
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? userId : null;
}

export function unsubscribeUrl(userId: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://repoherald.com";
  return `${base}/unsubscribe?token=${encodeURIComponent(unsubscribeToken(userId))}`;
}
