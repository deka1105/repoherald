import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sponsorships, stripeEvents } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { writeAudit } from "@/lib/audit";

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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const sponsorshipId = session.client_reference_id;
      if (!sponsorshipId) break;
      const durationDays = Number(session.metadata?.duration_days ?? 0) || 7;
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + durationDays * 86_400_000);
      await db
        .update(sponsorships)
        .set({
          status: "active",
          startsAt,
          endsAt,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          amountCents: session.amount_total ?? undefined,
        })
        .where(eq(sponsorships.id, sponsorshipId));
      await writeAudit(db, {
        actorType: "stripe",
        action: "sponsorship.activate",
        entityType: "sponsorship",
        entityId: sponsorshipId,
        metadata: { durationDays, amountCents: session.amount_total },
      });
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object;
      if (session.client_reference_id) {
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
