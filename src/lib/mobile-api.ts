/**
 * Shared plumbing for the `/api/mobile/v1/*` routes.
 *
 * The web resolves "who is this" from an Auth.js cookie via `requireUser()`.
 * A native app cannot carry that cookie, so every mobile route resolves the
 * bearer token instead (see src/lib/mobile-auth.ts). This module is the single
 * place that does it, so the deleted-account check below cannot be forgotten
 * on a route added later.
 */
import "server-only";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { userIdFrom } from "@/lib/mobile-auth";

export type MobileUser = typeof users.$inferSelect;

/**
 * The live account a bearer token proves, or null.
 *
 * `purgeAccount` anonymises rather than deletes — the credit ledger's foreign
 * keys have to stay intact — and clears `clerk_user_id` while doing so. Since
 * every mobile session is established through Clerk, a NULL `clerk_user_id`
 * means the account behind this token is gone. A token cannot be revoked
 * before it expires, so checking that column is the entire mechanism by which
 * a deleted account stops working on a device still holding a valid signature.
 */
export async function mobileUser(req: Request): Promise<MobileUser | null> {
  const userId = userIdFrom(req);
  if (!userId) return null;

  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!row || !row.clerkUserId) return null;
  return row;
}

/** Every mobile response carries `version` so an old binary can tell. */
export function ok<T extends Record<string, unknown>>(data: T, init?: ResponseInit) {
  return NextResponse.json({ version: 1, ...data }, init);
}

export function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export const unauthenticated = () => fail("unauthenticated", 401);
export const notFound = (what = "Not found") => fail(what, 404);

/**
 * Parse a JSON body, or null if it is absent or malformed.
 *
 * Returns null rather than throwing because every caller wants the same 400,
 * and an unhandled throw here would be a 500 — which reads as "the server is
 * broken" to a client that simply sent nonsense.
 */
export async function jsonBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** A required non-empty string field, or null. */
export function str(body: Record<string, unknown>, key: string): string | null {
  const v = body[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
