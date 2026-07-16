"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { creditPurchases } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { getStripe } from "@/lib/stripe";
import { writeAudit } from "@/lib/audit";
import { getCreditPackByKey, STRIPE_MIN_CENTS } from "@/lib/pricing";
import { discountedCents } from "@/components/plan-price";

export type BuyCreditsState = { error?: string };

export async function startCreditPurchase(
  _prev: BuyCreditsState,
  formData: FormData
): Promise<BuyCreditsState> {
  const user = await requireUser();
  const packKey = String(formData.get("pack") ?? "");

  const pack = await getCreditPackByKey(packKey);
  if (!pack || !pack.active) return { error: "Pick a credit pack." };

  // No free-comp path for credit packs (unlike sponsorships) — a pack priced
  // under Stripe's minimum would be an unlimited free-credits faucet.
  const finalCents = discountedCents(pack.amountCents, pack.discountPercent);
  if (finalCents < STRIPE_MIN_CENTS) {
    return { error: "This pack can't be purchased right now." };
  }

  const [purchase] = await db
    .insert(creditPurchases)
    .values({
      userId: user.id,
      packId: pack.id,
      credits: pack.credits,
      amountCents: finalCents,
    })
    .returning();

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: pack.currency,
          unit_amount: finalCents,
          product_data: {
            name: `repoherald credits — ${pack.label} (${pack.credits} credits)`,
          },
        },
        quantity: 1,
      },
    ],
    client_reference_id: purchase.id,
    metadata: {
      credit_purchase_id: purchase.id,
      user_id: user.id,
      pack_key: pack.key,
      credits: String(pack.credits),
    },
    success_url: `${origin}/wallet?purchase=success`,
    cancel_url: `${origin}/credits?status=cancelled`,
  });

  await db
    .update(creditPurchases)
    .set({ stripeCheckoutSessionId: session.id })
    .where(eq(creditPurchases.id, purchase.id));
  await writeAudit(db, {
    actorUserId: user.id,
    actorType: "user",
    action: "credit.purchase_started",
    entityType: "credit_purchase",
    entityId: purchase.id,
    metadata: { packKey: pack.key, credits: pack.credits, amountCents: finalCents },
  });

  redirect(session.url!);
}
