import "server-only";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appSettings,
  discountCodes,
  discountRedemptions,
  sponsorPlans,
} from "@/db/schema";

export type SponsorPlan = typeof sponsorPlans.$inferSelect;
export type DiscountCode = typeof discountCodes.$inferSelect;

// Stripe rejects card charges below this (USD). A discount that brings the
// total to/under this is treated as a free comp (sponsorship activated directly).
export const STRIPE_MIN_CENTS = 50;

// Defaults used when app_settings has no row yet. Kept in sync with the
// exported constants in src/lib/credits.ts.
const DEFAULT_CLAIM_CAPS = { daily: 6, weekly: 20 };

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function formatCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export async function getActivePlans(): Promise<SponsorPlan[]> {
  return db
    .select()
    .from(sponsorPlans)
    .where(eq(sponsorPlans.active, true))
    .orderBy(asc(sponsorPlans.sortOrder), asc(sponsorPlans.amountCents));
}

export async function getAllPlans(): Promise<SponsorPlan[]> {
  return db
    .select()
    .from(sponsorPlans)
    .orderBy(asc(sponsorPlans.sortOrder), asc(sponsorPlans.amountCents));
}

export async function getPlanByKey(key: string): Promise<SponsorPlan | null> {
  const [p] = await db
    .select()
    .from(sponsorPlans)
    .where(eq(sponsorPlans.key, key))
    .limit(1);
  return p ?? null;
}

// Per-instance cache so the hot claim path doesn't hit app_settings every mint.
let capsCache: { at: number; caps: { daily: number; weekly: number } } | null = null;
const CAPS_TTL_MS = 30_000;

export async function getClaimCaps(): Promise<{ daily: number; weekly: number }> {
  if (capsCache && Date.now() - capsCache.at < CAPS_TTL_MS) return capsCache.caps;
  const caps = { ...DEFAULT_CLAIM_CAPS };
  try {
    const rows = await db.select().from(appSettings);
    for (const r of rows) {
      if (r.key === "daily_mint_cap") caps.daily = r.value;
      if (r.key === "weekly_mint_cap") caps.weekly = r.value;
    }
  } catch {
    // fall back to defaults if the table isn't there yet
  }
  capsCache = { at: Date.now(), caps };
  return caps;
}

export function invalidateCapsCache() {
  capsCache = null;
}

export async function setClaimCap(key: "daily_mint_cap" | "weekly_mint_cap", value: number) {
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
  invalidateCapsCache();
}

export type DiscountResult =
  | { ok: true; code: DiscountCode; amountOffCents: number; finalCents: number; free: boolean }
  | { ok: false; error: string };

/**
 * Validate a code for a given user against a pre-discount total and compute the
 * discounted price. Pure read (no side effects); redemption is recorded later.
 */
export async function computeDiscount(
  rawCode: string,
  userId: string,
  baseCents: number
): Promise<DiscountResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, error: "Enter a code." };

  const [row] = await db
    .select()
    .from(discountCodes)
    .where(
      and(
        eq(discountCodes.code, code),
        eq(discountCodes.active, true),
        // Global (user_id NULL) or scoped to this user.
        or(isNull(discountCodes.userId), eq(discountCodes.userId, userId))
      )
    )
    .limit(1);

  if (!row) return { ok: false, error: "That code isn't valid." };
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, error: "That code has expired." };
  }
  if (row.maxRedemptions != null && row.timesRedeemed >= row.maxRedemptions) {
    return { ok: false, error: "That code has been fully redeemed." };
  }
  if (row.minAmountCents != null && baseCents < row.minAmountCents) {
    return {
      ok: false,
      error: `This code needs a total of at least ${formatCents(row.minAmountCents)}.`,
    };
  }

  const amountOffCents =
    row.kind === "percent"
      ? Math.floor((baseCents * row.value) / 100)
      : Math.min(row.value, baseCents);
  const finalCents = Math.max(0, baseCents - amountOffCents);
  const free = finalCents < STRIPE_MIN_CENTS;

  return { ok: true, code: row, amountOffCents, finalCents, free };
}

/**
 * Atomically bump a code's redemption counter, refusing to exceed maxRedemptions.
 * Returns true if the increment succeeded (a redemption slot was reserved).
 */
export async function tryReserveRedemption(codeId: string): Promise<boolean> {
  const res = await db
    .update(discountCodes)
    .set({ timesRedeemed: sql`${discountCodes.timesRedeemed} + 1` })
    .where(
      and(
        eq(discountCodes.id, codeId),
        or(
          isNull(discountCodes.maxRedemptions),
          sql`${discountCodes.timesRedeemed} < ${discountCodes.maxRedemptions}`
        )
      )
    )
    .returning({ id: discountCodes.id });
  return res.length > 0;
}
