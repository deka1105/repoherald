"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { repos, users } from "@/db/schema";
import { redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { requireUser } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { log } from "@/lib/log";

/**
 * GDPR-style deletion: purge tokens and PII and anonymize the user row, but
 * keep ledger/audit rows (financial integrity) under the anonymized id.
 * Their listings are hidden — ownership can no longer be verified.
 */
export async function deleteAccount() {
  const user = await requireUser();
  const anonLogin = `deleted-${user.id.slice(0, 8)}`;
  // Captured before the transaction clears it.
  const clerkUserId = user.clerkUserId;

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        githubLogin: anonLogin,
        name: null,
        email: null,
        avatarUrl: null,
        githubAccessTokenEnc: null,
        tokenInvalidAt: new Date(),
        githubCreatedAt: null,
        githubPublicRepos: null,
        githubFollowers: null,
        mintEligible: false,
        role: "user",
        // Unlinked so the anonymised row is never adopted by a later sign-in
        // that happens to match on one of the cleared fields.
        clerkUserId: null,
        googleId: null,
      })
      .where(eq(users.id, user.id));
    await tx
      .update(repos)
      .set({ status: "hidden", removedReason: "owner_account_deleted" })
      .where(eq(repos.postedByUserId, user.id));
    await writeAudit(tx, {
      actorUserId: user.id,
      actorType: "user",
      action: "user.delete_account",
      entityType: "user",
      entityId: user.id,
    });
  });

  log.info("user.deleted", { userId: user.id });

  // Deleting the Clerk user is what actually ends the session — it revokes
  // every device at once, which a cookie-clearing sign-out would not. Best
  // effort: the local row is already anonymised, so a failure here must not
  // leave the caller on a page that says their account still exists.
  if (clerkUserId) {
    try {
      const client = await clerkClient();
      await client.users.deleteUser(clerkUserId);
    } catch (e) {
      log.error("user.delete_account.clerk_failed", e);
    }
  }
  redirect("/");
}
