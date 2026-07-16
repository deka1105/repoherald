"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { creditPacks, discountCodes, sponsorPlans, users } from "@/db/schema";
import { requireAdmin } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { normalizeCode, setClaimCap } from "@/lib/pricing";

const BASE = "/admin/pricing";

function done(msg: string): never {
  revalidatePath(BASE);
  redirect(`${BASE}?msg=${encodeURIComponent(msg)}`);
}
function fail(err: string): never {
  redirect(`${BASE}?err=${encodeURIComponent(err)}`);
}

function s(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}
function dollarsToCents(v: string): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
function intOrNull(v: string): number | null {
  if (v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// ---- Sponsorship plans ----------------------------------------------------

export async function savePlan(fd: FormData) {
  const admin = await requireAdmin();
  const id = s(fd, "id");
  const key = s(fd, "key").toLowerCase();
  const label = s(fd, "label");
  const durationDays = Number(s(fd, "durationDays"));
  const starsCap = intOrNull(s(fd, "starsCap"));
  const amountCents = dollarsToCents(s(fd, "amount"));
  const discountPercent = Number(s(fd, "discountPercent") || "0");
  const active = fd.get("active") === "on";
  const sortOrder = Number(s(fd, "sortOrder") || "0");

  if (!key || !label) fail("Plan key and label are required.");
  if (!Number.isInteger(durationDays) || durationDays <= 0)
    fail("Duration must be a positive whole number of days.");
  if (amountCents == null) fail("Enter a valid price.");
  if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 100)
    fail("Discount must be a whole percent between 0 and 100.");

  if (id) {
    await db
      .update(sponsorPlans)
      .set({
        key,
        label,
        durationDays,
        starsCap,
        amountCents,
        discountPercent,
        active,
        sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
        updatedAt: new Date(),
      })
      .where(eq(sponsorPlans.id, id));
    await writeAudit(db, {
      actorUserId: admin.id,
      actorType: "admin",
      action: "plan.update",
      entityType: "sponsor_plan",
      entityId: id,
      metadata: { key, amountCents, durationDays, starsCap, active },
    });
    done("Plan updated.");
  }

  try {
    const [row] = await db
      .insert(sponsorPlans)
      .values({
        key,
        label,
        durationDays,
        starsCap,
        amountCents,
        discountPercent,
        active,
        sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
      })
      .returning({ id: sponsorPlans.id });
    await writeAudit(db, {
      actorUserId: admin.id,
      actorType: "admin",
      action: "plan.create",
      entityType: "sponsor_plan",
      entityId: row.id,
      metadata: { key, amountCents, durationDays, starsCap },
    });
  } catch {
    fail(`A plan with key "${key}" already exists.`);
  }
  done("Plan created.");
}

export async function deletePlan(fd: FormData) {
  const admin = await requireAdmin();
  const id = s(fd, "id");
  if (!id) fail("Missing plan id.");
  await db.delete(sponsorPlans).where(eq(sponsorPlans.id, id));
  await writeAudit(db, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "plan.delete",
    entityType: "sponsor_plan",
    entityId: id,
  });
  done("Plan deleted.");
}

// ---- Credit packs ----------------------------------------------------------

export async function savePack(fd: FormData) {
  const admin = await requireAdmin();
  const id = s(fd, "id");
  const key = s(fd, "key").toLowerCase();
  const label = s(fd, "label");
  const credits = Number(s(fd, "credits"));
  const amountCents = dollarsToCents(s(fd, "amount"));
  const discountPercent = Number(s(fd, "discountPercent") || "0");
  const active = fd.get("active") === "on";
  const sortOrder = Number(s(fd, "sortOrder") || "0");

  if (!key || !label) fail("Pack key and label are required.");
  if (!Number.isInteger(credits) || credits <= 0)
    fail("Credits must be a positive whole number.");
  if (amountCents == null) fail("Enter a valid price.");
  if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 100)
    fail("Discount must be a whole percent between 0 and 100.");

  if (id) {
    await db
      .update(creditPacks)
      .set({
        key,
        label,
        credits,
        amountCents,
        discountPercent,
        active,
        sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
        updatedAt: new Date(),
      })
      .where(eq(creditPacks.id, id));
    await writeAudit(db, {
      actorUserId: admin.id,
      actorType: "admin",
      action: "credit_pack.update",
      entityType: "credit_pack",
      entityId: id,
      metadata: { key, credits, amountCents, active },
    });
    done("Credit pack updated.");
  }

  try {
    const [row] = await db
      .insert(creditPacks)
      .values({
        key,
        label,
        credits,
        amountCents,
        discountPercent,
        active,
        sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
      })
      .returning({ id: creditPacks.id });
    await writeAudit(db, {
      actorUserId: admin.id,
      actorType: "admin",
      action: "credit_pack.create",
      entityType: "credit_pack",
      entityId: row.id,
      metadata: { key, credits, amountCents },
    });
  } catch {
    fail(`A pack with key "${key}" already exists.`);
  }
  done("Credit pack created.");
}

export async function deletePack(fd: FormData) {
  const admin = await requireAdmin();
  const id = s(fd, "id");
  if (!id) fail("Missing pack id.");
  // Packs with purchases can't be deleted (credit_purchases FK) — disable
  // instead so the purchase history stays intact.
  try {
    await db.delete(creditPacks).where(eq(creditPacks.id, id));
  } catch {
    await db.update(creditPacks).set({ active: false }).where(eq(creditPacks.id, id));
    await writeAudit(db, {
      actorUserId: admin.id,
      actorType: "admin",
      action: "credit_pack.disable",
      entityType: "credit_pack",
      entityId: id,
      metadata: { reason: "delete_blocked_has_purchases" },
    });
    done("Pack has purchases — disabled instead of deleted.");
  }
  await writeAudit(db, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "credit_pack.delete",
    entityType: "credit_pack",
    entityId: id,
  });
  done("Credit pack deleted.");
}

// ---- Global claim caps ----------------------------------------------------

export async function updateClaimCaps(fd: FormData) {
  const admin = await requireAdmin();
  const daily = Number(s(fd, "daily"));
  const weekly = Number(s(fd, "weekly"));
  if (!Number.isInteger(daily) || daily < 1) fail("Daily cap must be a positive integer.");
  if (!Number.isInteger(weekly) || weekly < 1)
    fail("Weekly cap must be a positive integer.");
  await setClaimCap("daily_mint_cap", daily);
  await setClaimCap("weekly_mint_cap", weekly);
  await writeAudit(db, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "claim_caps.update",
    metadata: { daily, weekly },
  });
  done("Star claim limits updated.");
}

// ---- Discount codes -------------------------------------------------------

export async function createDiscount(fd: FormData) {
  const admin = await requireAdmin();
  const code = normalizeCode(s(fd, "code"));
  const kind = s(fd, "kind");
  const value = Number(s(fd, "value"));
  const scopeLogin = s(fd, "scopeLogin");
  const maxRedemptions = intOrNull(s(fd, "maxRedemptions"));
  const minAmount = s(fd, "minAmount");
  const minAmountCents = minAmount === "" ? null : dollarsToCents(minAmount);
  const expiresRaw = s(fd, "expiresAt");
  const note = s(fd, "note") || null;

  if (!code || !/^[A-Z0-9_-]{3,40}$/.test(code))
    fail("Code must be 3–40 chars: letters, numbers, - or _.");
  if (kind !== "percent" && kind !== "fixed") fail("Pick a discount type.");
  if (kind === "percent" && (!Number.isInteger(value) || value < 1 || value > 100))
    fail("Percent must be between 1 and 100.");
  if (kind === "fixed" && (!Number.isInteger(value) || value < 1))
    fail("Fixed amount (in cents) must be a positive integer.");
  if (minAmount !== "" && minAmountCents == null) fail("Min order total is invalid.");

  let userId: string | null = null;
  if (scopeLogin) {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.githubLogin}) = ${scopeLogin.toLowerCase()}`)
      .limit(1);
    if (!u) fail(`No user with GitHub login "${scopeLogin}".`);
    userId = u.id;
  }

  let expiresAt: Date | null = null;
  if (expiresRaw) {
    const d = new Date(expiresRaw);
    if (Number.isNaN(d.getTime())) fail("Expiry date is invalid.");
    expiresAt = d;
  }

  try {
    const [row] = await db
      .insert(discountCodes)
      .values({
        code,
        kind,
        value,
        userId,
        maxRedemptions,
        minAmountCents,
        expiresAt,
        note,
        createdByUserId: admin.id,
      })
      .returning({ id: discountCodes.id });
    await writeAudit(db, {
      actorUserId: admin.id,
      actorType: "admin",
      action: "discount.create",
      entityType: "discount_code",
      entityId: row.id,
      metadata: { code, kind, value, userId, maxRedemptions },
    });
  } catch {
    fail(`A code named "${code}" already exists.`);
  }
  done(userId ? `Created user-specific code ${code}.` : `Created global code ${code}.`);
}

export async function setDiscountActive(fd: FormData) {
  const admin = await requireAdmin();
  const id = s(fd, "id");
  const active = s(fd, "active") === "true";
  if (!id) fail("Missing code id.");
  await db.update(discountCodes).set({ active }).where(eq(discountCodes.id, id));
  await writeAudit(db, {
    actorUserId: admin.id,
    actorType: "admin",
    action: active ? "discount.enable" : "discount.disable",
    entityType: "discount_code",
    entityId: id,
  });
  done(active ? "Code enabled." : "Code disabled.");
}

export async function deleteDiscount(fd: FormData) {
  const admin = await requireAdmin();
  const id = s(fd, "id");
  if (!id) fail("Missing code id.");
  // Only delete codes that have never been redeemed; otherwise just disable so
  // the redemption history's foreign key stays intact.
  const [row] = await db
    .select({ times: discountCodes.timesRedeemed })
    .from(discountCodes)
    .where(eq(discountCodes.id, id))
    .limit(1);
  if (row && row.times > 0) {
    await db.update(discountCodes).set({ active: false }).where(eq(discountCodes.id, id));
    await writeAudit(db, {
      actorUserId: admin.id,
      actorType: "admin",
      action: "discount.disable",
      entityType: "discount_code",
      entityId: id,
      metadata: { reason: "delete_blocked_has_redemptions" },
    });
    done("Code had redemptions — disabled instead of deleted.");
  }
  await db.delete(discountCodes).where(and(eq(discountCodes.id, id)));
  await writeAudit(db, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "discount.delete",
    entityType: "discount_code",
    entityId: id,
  });
  done("Code deleted.");
}
