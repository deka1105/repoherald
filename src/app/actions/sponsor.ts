"use server";

import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { repos, sponsorships } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { SPONSOR_PRICES, getStripe } from "@/lib/stripe";

export type SponsorState = { error?: string };

export async function startSponsorship(
  _prev: SponsorState,
  formData: FormData
): Promise<SponsorState> {
  const user = await requireUser();
  const repoId = String(formData.get("repoId") ?? "");
  const plan = String(formData.get("plan") ?? "");

  const priceConf = SPONSOR_PRICES[plan];
  if (!priceConf) return { error: "Pick a sponsorship duration." };
  const priceId = process.env[priceConf.priceEnv];
  if (!priceId) return { error: "Sponsorships aren't configured yet." };

  const repo = await db.query.repos.findFirst({ where: eq(repos.id, repoId) });
  if (!repo || repo.status !== "active") return { error: "Pick an active listing." };

  // Clear out stale pending rows so an abandoned checkout doesn't block the
  // repo forever (the partial unique index allows one live row per repo).
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
        durationDays: priceConf.days,
        starsCap: priceConf.starsCap,
        createdVia: "stripe",
        stripePriceId: priceId,
      })
      .returning();
  } catch {
    return { error: "This repo already has an active or pending sponsorship." };
  }

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: sponsorship.id,
    metadata: {
      sponsorship_id: sponsorship.id,
      repo_id: repoId,
      user_id: user.id,
      duration_days: String(priceConf.days),
    },
    success_url: `${origin}/sponsor?status=success`,
    cancel_url: `${origin}/sponsor?status=cancelled`,
  });

  await db
    .update(sponsorships)
    .set({ stripeCheckoutSessionId: session.id })
    .where(eq(sponsorships.id, sponsorship.id));

  redirect(session.url!);
}
