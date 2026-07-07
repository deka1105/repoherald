"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  creditEntries,
  reports,
  repos,
  sponsorships,
  starMints,
  users,
} from "@/db/schema";
import { requireAdmin } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { refundSponsorshipForRepo } from "@/lib/stripe";

function ok(): { error?: string } {
  return {};
}

export async function setRepoStatus(
  repoId: string,
  status: "active" | "hidden" | "removed"
) {
  const admin = await requireAdmin();
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
    actorUserId: admin.id,
    actorType: "admin",
    action: `listing.${status}`,
    entityType: "repo",
    entityId: repoId,
  });
  revalidatePath("/admin/listings");
  revalidatePath("/");
  return ok();
}

export async function resolveReport(reportId: string) {
  const admin = await requireAdmin();
  await db
    .update(reports)
    .set({ status: "resolved" })
    .where(eq(reports.id, reportId));
  await writeAudit(db, {
    actorUserId: admin.id,
    actorType: "admin",
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

export async function toggleAdmin(userId: string, makeAdmin: boolean) {
  const admin = await requireAdmin();
  if (admin.id === userId && !makeAdmin) {
    return { error: "You can't remove your own admin access." };
  }
  await db.update(users).set({ isAdmin: makeAdmin }).where(eq(users.id, userId));
  await writeAudit(db, {
    actorUserId: admin.id,
    actorType: "admin",
    action: makeAdmin ? "user.grant_admin" : "user.revoke_admin",
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

export async function adminCreateSponsorship(formData: FormData) {
  const admin = await requireAdmin();
  const repoId = String(formData.get("repoId") ?? "");
  const days = Number(formData.get("days") ?? 0);
  const sponsorName = String(formData.get("sponsorName") ?? "").trim() || null;
  if (!repoId || !Number.isInteger(days) || days < 1 || days > 365) {
    return { error: "Repo and a duration between 1 and 365 days are required." };
  }
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + days * 86_400_000);
  try {
    const [s] = await db
      .insert(sponsorships)
      .values({
        repoId,
        sponsorName,
        startsAt,
        endsAt,
        durationDays: days,
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
      metadata: { repoId, days },
    });
  } catch {
    return { error: "This repo already has a live sponsorship." };
  }
  revalidatePath("/admin/sponsorships");
  revalidatePath("/");
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
