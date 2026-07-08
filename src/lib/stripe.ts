import Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { sponsorships } from "@/db/schema";
import { writeAudit } from "@/lib/audit";

// Lazy so builds (and non-Stripe paths) work before the key is configured.
let stripeClient: Stripe | null = null;
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

// Each plan ends at the day limit OR when the repo gains this many stars,
// whichever comes first.
export const SPONSOR_PRICES: Record<
  string,
  { priceEnv: string; days: number; starsCap: number; label: string }
> = {
  "7d": { priceEnv: "STRIPE_PRICE_7D", days: 7, starsCap: 75, label: "7 days or 75 stars" },
  "15d": { priceEnv: "STRIPE_PRICE_15D", days: 15, starsCap: 160, label: "15 days or 160 stars" },
  "30d": { priceEnv: "STRIPE_PRICE_30D", days: 30, starsCap: 350, label: "30 days or 350 stars" },
};

/**
 * Pro-rated refund when a sponsored repo is removed mid-run: refund the
 * unused fraction of the paid amount and cancel the sponsorship.
 */
export async function refundSponsorshipForRepo(repoId: string) {
  const [s] = await db
    .select()
    .from(sponsorships)
    .where(
      and(
        eq(sponsorships.repoId, repoId),
        eq(sponsorships.status, "active"),
        sql`${sponsorships.endsAt} > now()`
      )
    )
    .limit(1);
  if (!s) return;

  let refundedCents = 0;
  if (
    s.createdVia === "stripe" &&
    s.stripePaymentIntentId &&
    s.amountCents &&
    s.startsAt &&
    s.endsAt
  ) {
    const total = s.endsAt.getTime() - s.startsAt.getTime();
    const unused = Math.max(0, s.endsAt.getTime() - Date.now());
    refundedCents = Math.floor((s.amountCents * unused) / total);
    if (refundedCents > 0) {
      await getStripe().refunds.create({
        payment_intent: s.stripePaymentIntentId,
        amount: refundedCents,
      });
    }
  }

  await db
    .update(sponsorships)
    .set({ status: "cancelled", endsAt: new Date() })
    .where(eq(sponsorships.id, s.id));
  await writeAudit(db, {
    actorType: "system",
    action: "sponsorship.prorated_refund",
    entityType: "sponsorship",
    entityId: s.id,
    metadata: { repoId, refundedCents },
  });
}
