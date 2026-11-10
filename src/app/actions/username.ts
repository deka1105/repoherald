"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { db } from "@/db";
import { setUsername } from "@/lib/username-claim";

export type UsernameState = { error?: string; ok?: string };

/**
 * Change the signed-in account's public handle.
 *
 * Every account already has one — generated at sign-up — so this is a change,
 * never a first claim, and there is no "clear it" branch: the handle is how the
 * chrome and comment bylines address this person.
 *
 * Audited, like the social-handle claim. Changing a handle is cheap and
 * reversible, so it is not rate-limited, but a handle is also how other users
 * recognise each other: the audit trail is what makes a pattern of churn
 * visible to moderation rather than silent.
 */
export async function changeUsername(
  _prev: UsernameState,
  formData: FormData
): Promise<UsernameState> {
  const user = await requireUser();
  const raw = String(formData.get("username") ?? "");

  const result = await setUsername(user.id, raw);
  if (!result.ok) return { error: result.reason };

  if (result.username !== user.username) {
    await writeAudit(db, {
      actorUserId: user.id,
      actorType: "user",
      action: "account.username.set",
      entityType: "user",
      entityId: user.id,
      metadata: { from: user.username, to: result.username },
    });
  }

  // The handle shows in the header and on the feed's compose row, so the
  // whole chrome is stale after this, not just the settings page.
  revalidatePath("/", "layout");

  return { ok: `You're now @${result.username}.` };
}
