import "server-only";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { repos, users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { log } from "@/lib/log";

/**
 * GDPR-style deletion: purge tokens and PII and anonymize the user row, but
 * keep ledger/audit rows (financial integrity) under the anonymized id.
 * Their listings are hidden — ownership can no longer be verified.
 *
 * Lives here rather than in the server action because App Store Guideline
 * 5.1.1(v) requires the iOS app to delete an account from inside the app, and
 * a native client cannot call a server action. The web action and
 * `DELETE /api/mobile/v1/me` are two doors onto this one function, so the two
 * platforms can never drift into deleting different amounts of a person.
 */
export async function purgeAccount(user: {
  id: string;
  clerkUserId: string | null;
}): Promise<void> {
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
  // leave the caller believing their account still exists.
  //
  // The mobile bearer token is not revoked by this, because it cannot be (see
  // src/lib/mobile-auth.ts). It is instead made useless: /me resolves the
  // token's user id against `users.clerk_user_id`, which is now NULL, so every
  // later request 401s and the app treats itself as signed out.
  if (user.clerkUserId) {
    try {
      const client = await clerkClient();
      await client.users.deleteUser(user.clerkUserId);
    } catch (e) {
      log.error("user.delete_account.clerk_failed", e);
    }
  }
}
