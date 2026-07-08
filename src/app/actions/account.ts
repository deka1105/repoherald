"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { repos, users } from "@/db/schema";
import { signOut } from "@/auth";
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
        isAdmin: false,
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
  await signOut({ redirectTo: "/" });
}
