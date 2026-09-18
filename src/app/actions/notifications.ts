"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export async function markCreditsSeen() {
  const session = await auth();
  if (!session?.user?.id) return;
  await db
    .update(users)
    .set({ creditsSeenAt: new Date() })
    .where(eq(users.id, session.user.id));
}

/** Toggle whether the user is emailed when a new sponsored repo goes live. */
export async function updateSponsorAlerts(optIn: boolean) {
  const session = await auth();
  if (!session?.user?.id) return;
  await db
    .update(users)
    .set({ sponsorAlertsOptIn: optIn })
    .where(eq(users.id, session.user.id));
  revalidatePath("/wallet");
}

/**
 * Re-enable sponsor alerts from the unsubscribe page's undo button. Authorised
 * by the signed token rather than a session, because the person who clicked an
 * unsubscribe link in their inbox may well not be signed in.
 */
export async function resubscribeSponsorAlerts(token: string): Promise<boolean> {
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return false;
  await db
    .update(users)
    .set({ sponsorAlertsOptIn: true })
    .where(eq(users.id, userId));
  return true;
}
