"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { purgeAccount } from "@/lib/account-deletion";

/**
 * Delete the signed-in account.
 *
 * The purge itself lives in src/lib/account-deletion.ts because the iOS app
 * needs the identical operation through `DELETE /api/mobile/v1/me` — a native
 * client cannot call a server action, and App Store Guideline 5.1.1(v) will not
 * accept "delete it on the website".
 */
export async function deleteAccount() {
  const user = await requireUser();
  await purgeAccount({ id: user.id, clerkUserId: user.clerkUserId });
  redirect("/");
}
