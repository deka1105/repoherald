import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { userIdFrom } from "@/lib/mobile-auth";
import { purgeAccount } from "@/lib/account-deletion";

export const dynamic = "force-dynamic";

/**
 * Resolve a bearer token to a live account.
 *
 * Two ways to fail. The row can be missing — a token minted against a
 * different database. Or the row can still be there but no longer belong to
 * anyone: `purgeAccount` anonymises rather than deletes, to keep the credit
 * ledger's foreign keys intact, and it clears `clerk_user_id` while doing so.
 * Since every mobile session is now established through Clerk, a NULL
 * `clerk_user_id` means this token's account has been deleted or unlinked, and
 * a token cannot be revoked before it expires (see src/lib/mobile-auth.ts).
 * Checking it here is therefore the whole mechanism by which a deleted account
 * stops working on a device that still holds a valid signature.
 */
async function liveUser(req: Request) {
  const userId = userIdFrom(req);
  if (!userId) return null;

  const [row] = await db
    .select({
      id: users.id,
      clerkUserId: users.clerkUserId,
      githubLogin: users.githubLogin,
      name: users.name,
      avatarUrl: users.avatarUrl,
      creditBalance: users.creditBalance,
      mintEligible: users.mintEligible,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || !row.clerkUserId) return null;
  return row;
}

/** The signed-in user and their credit balance. */
export async function GET(req: Request) {
  const row = await liveUser(req);
  if (!row) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Listed field by field rather than spread minus clerk_user_id: this is a
  // public response shape, and an added column should not be able to leak into
  // it just because the query above grew.
  return NextResponse.json({
    version: 1,
    user: {
      id: row.id,
      githubLogin: row.githubLogin,
      name: row.name,
      avatarUrl: row.avatarUrl,
      creditBalance: row.creditBalance,
      mintEligible: row.mintEligible,
      role: row.role,
    },
  });
}

/**
 * Delete the signed-in account.
 *
 * App Store Guideline 5.1.1(v): an app that supports account creation must let
 * the user delete the account from inside the app, not only on a website. This
 * is the same purge the web's "Delete account" runs — one implementation, so
 * the two platforms cannot drift.
 *
 * No confirmation parameter: the confirmation is the app's two-step dialog.
 * Putting it in the protocol too would only mean a second thing to keep in
 * sync with a UI that already cannot reach here by accident.
 */
export async function DELETE(req: Request) {
  const row = await liveUser(req);
  if (!row) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  await purgeAccount({ id: row.id, clerkUserId: row.clerkUserId });

  return NextResponse.json({ version: 1, deleted: true });
}
