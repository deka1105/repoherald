/**
 * Bearer tokens for the mobile client.
 *
 * The web uses Auth.js JWT *cookies*, which a native app cannot carry. Rather
 * than bolt a second identity provider on, the app performs GitHub OAuth
 * itself, hands us the resulting GitHub access token once, and we exchange it
 * for one of these. From then on the app sends `Authorization: Bearer <token>`.
 *
 * Format: `<expiresMs>.<userId>.<sig>` — the same shape as the share tokens in
 * src/lib/shares.ts, deliberately. The signature covers both the expiry and the
 * user id, so neither can be edited independently.
 *
 * The user id is *inside* the signature rather than looked up from an opaque
 * token because that keeps verification a pure function — no database round
 * trip on every request. The cost is that a token cannot be revoked before it
 * expires, which is why the lifetime is 30 days and not a year.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function key(): string | null {
  return process.env.AUTH_SECRET?.trim() || null;
}

function sign(expires: number, userId: string, k: string): string {
  return createHmac("sha256", k).update(`${expires}.${userId}`).digest("base64url");
}

/**
 * Mint a bearer token for a user. Null when AUTH_SECRET is unset, so a
 * misconfigured environment refuses to issue credentials rather than issuing
 * forgeable ones.
 */
export function mintMobileToken(userId: string): { token: string; expiresAt: string } | null {
  const k = key();
  if (!k) return null;
  const expires = Date.now() + TOKEN_TTL_MS;
  return {
    token: `${expires}.${userId}.${sign(expires, userId, k)}`,
    expiresAt: new Date(expires).toISOString(),
  };
}

/** The user id a token proves, or null if it is absent, malformed or expired. */
export function verifyMobileToken(token: string | null | undefined): string | null {
  const k = key();
  if (!k || !token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [rawExpires, userId, sig] = parts;

  const expires = Number(rawExpires);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;
  if (!userId) return null;

  const expected = Buffer.from(sign(expires, userId, k));
  const given = Buffer.from(sig);
  // timingSafeEqual throws on a length mismatch, which is itself a signal.
  if (expected.length !== given.length) return null;
  return timingSafeEqual(expected, given) ? userId : null;
}

/** Pull the bearer token out of an Authorization header. */
export function bearerFrom(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h?.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim() || null;
}

/** Convenience: the authenticated user id for a request, or null. */
export function userIdFrom(req: Request): string | null {
  return verifyMobileToken(bearerFrom(req));
}
