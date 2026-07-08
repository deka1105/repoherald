"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

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
