"use server";

import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { repos, sponsorships } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { getStripe } from "@/lib/stripe";
import { writeAudit } from "@/lib/audit";
import { notifySponsorshipActivated } from "@/lib/notify";
import { computeDiscount, getPlanByKey, recordRedemption } from "@/lib/pricing";
import { discountedCents } from "@/components/plan-price";

export type PromoteState = { error?: string };

export async function startPromotion(
  _prev: PromoteState,
  formData: FormData
): Promise<PromoteState> {
  const user = await requireUser();
  const repoId = String(formData.get("repoId") ?? "");
  const planKey = String(formData.get("plan") ?? "");
  const rawCode = String(formData.get("discountCode") ?? "").trim();

  const plan = await getPlanByKey(planKey);
  if (!plan || !plan.active) return { error: "Pick a sponsorship plan." };

  const repo = await db.query.repos.findFirst({ where: eq(repos.id, repoId) });
  if (!repo || repo.status !== "active") return { error: "Pick an active listing." };

  // The plan's own sale discount sets the base price; a discount code (if any)
  // stacks on top of that reduced price.
  const baseCents = discountedCents(plan.amountCents, plan.discountPercent);
  let discountCodeId: string | null = null;
  let discountAmountCents = 0;
  let finalCents = baseCents;
  let free = baseCents < 50; // a 100% plan sale is a free comp on its own
  if (rawCode) {
    const d = await computeDiscount(rawCode, user.id, baseCents);
    if (!d.ok) return { error: d.error };
    discountCodeId = d.code.id;
    discountAmountCents = d.amountOffCents;
    finalCents = d.finalCents;
    free = d.free;
  }

  // Clear stale pending rows so an abandoned checkout doesn't block the repo.
  await db
    .delete(sponsorships)
    .where(
      and(
        eq(sponsorships.repoId, repoId),
        eq(sponsorships.status, "pending_payment"),
        sql`${sponsorships.createdAt} < now() - interval '2 hours'`
      )
    );

  let sponsorship;
  try {
    [sponsorship] = await db
      .insert(sponsorships)
      .values({
        repoId,
        sponsorUserId: user.id,
        sponsorName: user.githubLogin,
        durationDays: plan.durationDays,
        starsCap: plan.starsCap,
        createdVia: free ? "promo" : "stripe",
        discountCodeId,
        discountAmountCents: discountCodeId ? discountAmountCents : null,
      })
      .returning();
  } catch {
    return { error: "This repo already has an active or pending sponsorship." };
  }

  // 100%-off (or below Stripe's minimum) → comp it directly, no checkout.
  if (free) {
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + plan.durationDays * 86_400_000);
    await db
      .update(sponsorships)
      .set({
        status: "active",
        startsAt,
        endsAt,
        starsAtStart: repo.starsCount,
        amountCents: finalCents,
      })
      .where(eq(sponsorships.id, sponsorship.id));
    if (discountCodeId) {
      await recordRedemption({
        codeId: discountCodeId,
        userId: user.id,
        sponsorshipId: sponsorship.id,
        amountOffCents: discountAmountCents,
      });
    }
    await writeAudit(db, {
      actorUserId: user.id,
      actorType: "user",
      action: "sponsorship.comped",
      entityType: "sponsorship",
      entityId: sponsorship.id,
      metadata: { repoId, planKey, discountCodeId },
    });
    await notifySponsorshipActivated(sponsorship.id);
    redirect("/promote?status=success");
  }

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: plan.currency,
          unit_amount: finalCents,
          product_data: {
            name: `repoherald sponsorship — ${plan.label}`,
          },
        },
        quantity: 1,
      },
    ],
    client_reference_id: sponsorship.id,
    metadata: {
      sponsorship_id: sponsorship.id,
      repo_id: repoId,
      user_id: user.id,
      duration_days: String(plan.durationDays),
      plan_key: plan.key,
      discount_code_id: discountCodeId ?? "",
    },
    success_url: `${origin}/promote?status=success`,
    cancel_url: `${origin}/promote?status=cancelled`,
  });

  await db
    .update(sponsorships)
    .set({ stripeCheckoutSessionId: session.id })
    .where(eq(sponsorships.id, sponsorship.id));

  redirect(session.url!);
}
