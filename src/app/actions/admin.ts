"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  creditEntries,
  reports,
  repos,
  socialShares,
  sponsorships,
  starMints,
  supportTickets,
  users,
} from "@/db/schema";
import { requireAdmin, requireModerator } from "@/lib/authz";
import { grantShareReward } from "@/lib/credits";
import { writeAudit } from "@/lib/audit";
import { refundSponsorshipForRepo } from "@/lib/stripe";

function ok(): { error?: string } {
  return {};
}

function actorTypeOf(actor: { role: string }): "admin" | "moderator" {
  return actor.role === "admin" ? "admin" : "moderator";
}

export async function setRepoStatus(
  repoId: string,
  status: "active" | "hidden" | "removed"
) {
  const actor = await requireModerator();
  // Removal freezes mints and triggers Stripe refunds for sponsored repos —
  // money moves, so it stays admin-only. Moderators hide instead.
  if (status === "removed" && actor.role !== "admin") {
    return { error: "Only admins can remove listings — hide it instead." };
  }
  await db
    .update(repos)
    .set({ status, removedReason: status === "removed" ? "admin_removed" : null })
    .where(eq(repos.id, repoId));
  if (status === "removed") {
    await db
      .update(starMints)
      .set({ status: "frozen" })
      .where(sql`${starMints.repoId} = ${repoId} AND ${starMints.status} = 'minted'`);
    await refundSponsorshipForRepo(repoId);
  }
  await writeAudit(db, {
    actorUserId: actor.id,
    actorType: actorTypeOf(actor),
    action: `listing.${status}`,
    entityType: "repo",
    entityId: repoId,
  });
  revalidatePath("/admin/listings");
  revalidatePath("/");
  return ok();
}

export async function resolveReport(reportId: string) {
  const actor = await requireModerator();
  await db
    .update(reports)
    .set({ status: "resolved" })
    .where(eq(reports.id, reportId));
  await writeAudit(db, {
    actorUserId: actor.id,
    actorType: actorTypeOf(actor),
    action: "report.resolve",
    entityType: "report",
    entityId: reportId,
  });
  revalidatePath("/admin/listings");
  return ok();
}

export async function adjustCredits(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const delta = Number(formData.get("delta") ?? 0);
  const memo = String(formData.get("memo") ?? "").trim();
  if (!Number.isInteger(delta) || delta === 0) return { error: "Delta must be a non-zero integer." };
  if (!memo) return { error: "A memo is required for credit adjustments." };

  await db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (!user) throw new Error("User not found");
    await tx.insert(creditEntries).values({
      userId,
      delta,
      type: "admin_adjustment",
      adminUserId: admin.id,
      memo,
    });
    await tx
      .update(users)
      .set({ creditBalance: sql`${users.creditBalance} + ${delta}` })
      .where(eq(users.id, userId));
    await writeAudit(tx, {
      actorUserId: admin.id,
      actorType: "admin",
      action: "credit.admin_adjust",
      entityType: "user",
      entityId: userId,
      metadata: { delta, memo },
    });
  });
  revalidatePath("/admin/users");
  return ok();
}

export async function setEligibilityOverride(
  userId: string,
  override: "allowed" | "blocked" | null
) {
  const admin = await requireAdmin();
  await db
    .update(users)
    .set({ eligibilityOverride: override })
    .where(eq(users.id, userId));
  await writeAudit(db, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "user.eligibility_override",
    entityType: "user",
    entityId: userId,
    metadata: { override },
  });
  revalidatePath("/admin/users");
  return ok();
}

export async function setUserRole(
  userId: string,
  role: "user" | "moderator" | "admin"
) {
  const admin = await requireAdmin();
  if (admin.id === userId && role !== "admin") {
    return { error: "You can't remove your own admin access." };
  }
  // is_admin kept in sync while the deprecated column still exists.
  await db
    .update(users)
    .set({ role, isAdmin: role === "admin" })
    .where(eq(users.id, userId));
  await writeAudit(db, {
    actorUserId: admin.id,
    actorType: "admin",
    action: `user.set_role_${role}`,
    entityType: "user",
    entityId: userId,
  });
  revalidatePath("/admin/users");
  return ok();
}

export async function createCategory(formData: FormData) {
  const admin = await requireAdmin();
  const kind = String(formData.get("kind") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!label || (kind !== "use_case" && kind !== "sector")) {
    return { error: "Label and kind are required." };
  }
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  await db
    .insert(categories)
    .values({ kind: kind as "use_case" | "sector", slug, label })
    .onConflictDoNothing();
  await writeAudit(db, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "category.create",
    entityType: "category",
    entityId: slug,
  });
  revalidatePath("/admin/categories");
  return ok();
}

export async function toggleCategory(categoryId: string, isActive: boolean) {
  const admin = await requireAdmin();
  await db.update(categories).set({ isActive }).where(eq(categories.id, categoryId));
  await writeAudit(db, {
    actorUserId: admin.id,
    actorType: "admin",
    action: isActive ? "category.activate" : "category.deactivate",
    entityType: "category",
    entityId: categoryId,
  });
  revalidatePath("/admin/categories");
  return ok();
}

const ADMIN_PLANS: Record<string, { days: number; starsCap: number }> = {
  "7d": { days: 7, starsCap: 75 },
  "15d": { days: 15, starsCap: 160 },
  "30d": { days: 30, starsCap: 350 },
};

export async function adminCreateSponsorship(formData: FormData) {
  const admin = await requireAdmin();
  const repoId = String(formData.get("repoId") ?? "");
  const plan = ADMIN_PLANS[String(formData.get("plan") ?? "")];
  const sponsorName = String(formData.get("sponsorName") ?? "").trim() || null;
  if (!repoId || !plan) {
    return { error: "Repo and a plan are required." };
  }
  const repo = await db.query.repos.findFirst({ where: eq(repos.id, repoId) });
  if (!repo) return { error: "Repo not found." };
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + plan.days * 86_400_000);
  try {
    const [s] = await db
      .insert(sponsorships)
      .values({
        repoId,
        sponsorName,
        startsAt,
        endsAt,
        durationDays: plan.days,
        starsCap: plan.starsCap,
        starsAtStart: repo.starsCount,
        status: "active",
        createdVia: "admin",
      })
      .returning();
    await writeAudit(db, {
      actorUserId: admin.id,
      actorType: "admin",
      action: "sponsorship.create",
      entityType: "sponsorship",
      entityId: s.id,
      metadata: { repoId, days: plan.days, starsCap: plan.starsCap },
    });
  } catch {
    return { error: "This repo already has a live sponsorship." };
  }
  revalidatePath("/admin/sponsorships");
  revalidatePath("/");
  return ok();
}

export async function approveShare(shareId: string) {
  const admin = await requireAdmin();
  await grantShareReward(shareId, admin.id);
  revalidatePath("/admin/rewards");
  return ok();
}

export async function rejectShare(shareId: string) {
  const admin = await requireAdmin();
  await db
    .update(socialShares)
    .set({ status: "rejected", reviewedByUserId: admin.id, reviewedAt: new Date() })
    .where(eq(socialShares.id, shareId));
  await writeAudit(db, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "share.reject",
    entityType: "social_share",
    entityId: shareId,
  });
  revalidatePath("/admin/rewards");
  return ok();
}

export async function adminCancelSponsorship(sponsorshipId: string) {
  const admin = await requireAdmin();
  await db
    .update(sponsorships)
    .set({ status: "cancelled", endsAt: new Date() })
    .where(eq(sponsorships.id, sponsorshipId));
  await writeAudit(db, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "sponsorship.cancel",
    entityType: "sponsorship",
    entityId: sponsorshipId,
  });
  revalidatePath("/admin/sponsorships");
  revalidatePath("/");
  return ok();
}

export async function setSupportTicketStatus(
  ticketId: string,
  status: "open" | "resolved"
) {
  const admin = await requireAdmin();
  await db
    .update(supportTickets)
    .set({
      status,
      resolvedByUserId: status === "resolved" ? admin.id : null,
      resolvedAt: status === "resolved" ? new Date() : null,
    })
    .where(eq(supportTickets.id, ticketId));
  await writeAudit(db, {
    actorUserId: admin.id,
    actorType: "admin",
    action: status === "resolved" ? "support.resolve" : "support.reopen",
    entityType: "support_ticket",
    entityId: ticketId,
  });
  revalidatePath("/admin/support");
  return ok();
}
