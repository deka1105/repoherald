import { and, asc, eq, gt } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { creditEntries, users } from "@/db/schema";
import { CreditNotifierClient } from "./credit-notifier-client";

const MESSAGES: Record<string, (memo: string | null) => string> = {
  mint: () => "You received 1 credit for a verified star ⭐",
  social_share_reward: (memo) =>
    `Your ${memo?.replace(" share", "") ?? "social"} share was approved — +1 credit 🎉`,
  admin_adjustment: (memo) => `An admin adjusted your credits${memo ? `: ${memo}` : ""}`,
  highlight_cancellation_refund: () => "A queued highlight was cancelled — 1 credit refunded",
  revocation_clawback: () => "A star you claimed was revoked — 1 credit removed",
  social_share_clawback: () => "A shared post disappeared — its credit was removed",
  credit_expiry: (memo) => `Credits expired${memo ? `: ${memo}` : ""}`,
  welcome_bonus: () => `Welcome! ${WELCOME_BONUS_CREDITS} credits added to get you started 🎉`,
};

/** Surfaces ledger changes that happened while the user wasn't looking
 * (share approvals, admin adjustments, clawbacks) as toasts. */
export async function CreditNotifier() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  if (!user) return null;

  const unseen = await db
    .select()
    .from(creditEntries)
    .where(
      and(
        eq(creditEntries.userId, user.id),
        gt(creditEntries.createdAt, user.creditsSeenAt)
      )
    )
    .orderBy(asc(creditEntries.createdAt))
    .limit(10);

  // Spends are the user's own actions — no need to notify them.
  const notable = unseen.filter(
    (e) => !e.type.startsWith("spend_") && MESSAGES[e.type]
  );
  if (notable.length === 0) return null;

  return (
    <CreditNotifierClient
      messages={notable.map((e) => ({
        id: e.id,
        text: MESSAGES[e.type](e.memo),
        positive: e.delta > 0,
      }))}
      balance={user.creditBalance}
    />
  );
}
