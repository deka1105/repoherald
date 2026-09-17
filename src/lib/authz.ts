import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  if (!user) throw new Error("User not found");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Not authorized");
  return user;
}

/** Moderator-or-above: content/community tools. Money, credits, roles, and
 * pricing must keep using requireAdmin. */
export async function requireModerator() {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "moderator") {
    throw new Error("Not authorized");
  }
  return user;
}

/**
 * Vercel Cron authorization. Fails closed when CRON_SECRET is unset: comparing
 * against `Bearer ${process.env.CRON_SECRET}` with the var missing makes the
 * expected header the literal string "Bearer undefined", which anyone can send.
 * That matters because CRON_SECRET is set on Production only while DATABASE_URL
 * is set on Preview too — and the reverify job claws back credits and issues
 * Stripe refunds. Preview deployments are behind Vercel Authentication today,
 * but this must not depend on a dashboard toggle staying on.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const got = Buffer.from(header, "utf8");
  // Length check first: timingSafeEqual throws on a mismatch.
  return expected.length === got.length && timingSafeEqual(expected, got);
}
