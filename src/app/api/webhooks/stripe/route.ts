import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creditPurchases, repos, sponsorships, stripeEvents } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { clawbackPurchase, grantPurchasedCredits } from "@/lib/credits";
import { recordRedemption } from "@/lib/pricing";
import { writeAudit } from "@/lib/audit";
import { log } from "@/lib/log";
import { notifySponsorshipActivated } from "@/lib/notify";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: Stripe retries and can deliver out of order.
  const [claimed] = await db
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });
  if (!claimed) return NextResponse.json({ ok: true, duplicate: true });

  log.info("stripe.webhook", { eventId: event.id, type: event.type });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // Credit-pack purchases and sponsorships share this event; purchase
      // sessions are tagged with credit_purchase_id in their metadata.
      const purchaseId = session.metadata?.credit_purchase_id;
      if (purchaseId) {
        await grantPurchasedCredits(purchaseId, {
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          amountCents: session.amount_total ?? undefined,
        });
        break;
      }
      const sponsorshipId = session.client_reference_id;
      if (!sponsorshipId) break;
      const durationDays = Number(session.metadata?.duration_days ?? 0) || 7;
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + durationDays * 86_400_000);
      // Star-cap countdown starts from the repo's star count at activation.
      // Also pull the discount fields recorded at checkout so we can register
      // the redemption exactly once (idempotent via the redemptions unique idx).
      const [row] = await db
        .select({
          starsCount: repos.starsCount,
          discountCodeId: sponsorships.discountCodeId,
          discountAmountCents: sponsorships.discountAmountCents,
          sponsorUserId: sponsorships.sponsorUserId,
        })
        .from(repos)
        .innerJoin(sponsorships, eq(sponsorships.repoId, repos.id))
        .where(eq(sponsorships.id, sponsorshipId));
      await db
        .update(sponsorships)
        .set({
          status: "active",
          startsAt,
          endsAt,
          starsAtStart: row?.starsCount ?? 0,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          amountCents: session.amount_total ?? undefined,
        })
        .where(eq(sponsorships.id, sponsorshipId));
      if (row?.discountCodeId && row.sponsorUserId) {
        await recordRedemption({
          codeId: row.discountCodeId,
          userId: row.sponsorUserId,
          sponsorshipId,
          amountOffCents: row.discountAmountCents ?? 0,
        });
      }
      await writeAudit(db, {
        actorType: "stripe",
        action: "sponsorship.activate",
        entityType: "sponsorship",
        entityId: sponsorshipId,
        metadata: { durationDays, amountCents: session.amount_total },
      });
      // Best-effort email to opted-in users; never blocks the webhook.
      await notifySponsorshipActivated(sponsorshipId);
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object;
      const purchaseId = session.metadata?.credit_purchase_id;
      if (purchaseId) {
        await db
          .update(creditPurchases)
          .set({ status: "cancelled" })
          .where(
            and(
              eq(creditPurchases.id, purchaseId),
              eq(creditPurchases.status, "pending_payment")
            )
          );
      } else if (session.client_reference_id) {
        await db
          .update(sponsorships)
          .set({ status: "cancelled" })
          .where(eq(sponsorships.id, session.client_reference_id));
      }
      break;
    }
    case "charge.refunded":
    case "charge.dispute.created": {
      const charge =
        event.type === "charge.refunded"
          ? event.data.object
          : (event.data.object as Stripe.Dispute);
      const paymentIntent =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!paymentIntent) break;
      const [s] = await db
        .select()
        .from(sponsorships)
        .where(eq(sponsorships.stripePaymentIntentId, paymentIntent))
        .limit(1);
      if (s && (s.status === "active" || s.status === "pending_payment")) {
        await db
          .update(sponsorships)
          .set({ status: "cancelled", endsAt: new Date() })
          .where(eq(sponsorships.id, s.id));
        await writeAudit(db, {
          actorType: "stripe",
          action:
            event.type === "charge.refunded"
              ? "sponsorship.refunded"
              : "sponsorship.disputed",
          entityType: "sponsorship",
          entityId: s.id,
        });
      }
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
