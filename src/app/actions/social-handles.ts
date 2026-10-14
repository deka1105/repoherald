"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import {
  ensurePlatformList,
  HANDLE_COLUMN,
  HANDLE_FIELD,
  normaliseHandle,
  PLATFORM_LABEL,
  type Platform,
} from "@/lib/platform-lists";

export type HandleState = { error?: string; ok?: string };

/**
 * Claim (or clear) an Instagram / TikTok handle.
 *
 * Claiming is UNVERIFIED — we have no way to prove you own an Instagram
 * account, and the account page says so. The unique constraint is what stops
 * two people claiming the same handle; it is a collision guard, not proof.
 * What a claim actually buys you is modest and reversible: repos found in DMs
 * from that handle are filed into your own private list. Nothing is published
 * and nothing is charged, so the cost of a wrong claim is bounded.
 *
 * Clearing the handle leaves the list and its contents alone. Deleting
 * somebody's saved repos because they unlinked a handle would be a surprise.
 */
export async function setSocialHandle(
  platform: Platform,
  _prev: HandleState,
  formData: FormData
): Promise<HandleState> {
  const user = await requireUser();
  const raw = String(formData.get("handle") ?? "").trim();
  const column = HANDLE_COLUMN[platform];
  const label = PLATFORM_LABEL[platform];

  if (!raw) {
    await db
      .update(users)
      .set({ [HANDLE_FIELD[platform]]: null })
      .where(eq(users.id, user.id));
    revalidatePath("/account");
    return { ok: `${label} handle removed. Your list is untouched.` };
  }

  const handle = normaliseHandle(raw);
  if (!handle) {
    return {
      error: `That doesn't look like a ${label} handle. Letters, numbers, periods and underscores only.`,
    };
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(column, handle))
    .limit(1);
  if (existing.length && existing[0].id !== user.id) {
    return { error: `@${handle} is already claimed by another account.` };
  }

  await db
    .update(users)
    .set({ [HANDLE_FIELD[platform]]: handle })
    .where(eq(users.id, user.id));

  // Created now rather than lazily at filing time, so the user can see where
  // their finds will land before any arrive.
  const list = await ensurePlatformList(user.id, platform);

  await writeAudit(db, {
    actorUserId: user.id,
    actorType: "user",
    action: "account.social_handle.set",
    entityType: "user",
    entityId: user.id,
    metadata: { platform, handle },
  });

  revalidatePath("/account");
  revalidatePath(`/lists/${list.slug}`);
  return { ok: `@${handle} claimed. Finds will be filed into "${label} finds".` };
}

export async function setInstagramHandle(prev: HandleState, formData: FormData) {
  return setSocialHandle("instagram", prev, formData);
}

export async function setTiktokHandle(prev: HandleState, formData: FormData) {
  return setSocialHandle("tiktok", prev, formData);
}
