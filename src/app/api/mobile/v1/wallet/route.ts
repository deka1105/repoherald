import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { creditEntries, repos, starMints } from "@/db/schema";
import {
  DAILY_MINT_CAP,
  SELF_HIGHLIGHT_MINUTES,
  DONATION_MINUTES,
  WEEKLY_MINT_CAP,
  getClaimUsage,
} from "@/lib/credits";
import { mobileUser, ok, unauthenticated } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const LEDGER_PAGE = 100;

/**
 * The same ledger the web wallet renders — read-only in the app.
 *
 * Nothing here spends or buys. Selling a digital currency outside In-App
 * Purchase is a Guideline 3.1.1 rejection, so the purchase flow stays on the
 * web and the app does not link to it; spending is left out with it so the
 * screen has one honest job, which is showing where the balance came from.
 *
 * `users.credit_balance` is a cache over this append-only ledger and may go
 * negative, so it is reported as-is rather than recomputed — a balance here
 * that disagrees with the entries is a real condition worth seeing, not
 * something to paper over in a serialiser.
 */
const TYPE_LABELS: Record<string, string> = {
  mint: "Star claimed",
  spend_self_highlight: `Self-highlight (${SELF_HIGHLIGHT_MINUTES} min)`,
  spend_donation: `Donation (${DONATION_MINUTES} min)`,
  revocation_clawback: "Star revoked — clawback",
  highlight_cancellation_refund: "Highlight cancelled — refund",
  credit_expiry: "Credit expired",
  admin_adjustment: "Admin adjustment",
  social_share_reward: "Social share reward",
  social_share_clawback: "Share removed — clawback",
  welcome_bonus: "Welcome bonus",
  purchase: "Credits purchased",
  purchase_refund: "Purchase refunded — clawback",
  issue_report_reward: "Issue report validated",
};

export async function GET(req: Request) {
  const user = await mobileUser(req);
  if (!user) return unauthenticated();

  const [entries, usage, claimed, posted] = await Promise.all([
    db
      .select()
      .from(creditEntries)
      .where(eq(creditEntries.userId, user.id))
      .orderBy(desc(creditEntries.createdAt))
      .limit(LEDGER_PAGE),
    getClaimUsage(user.id),
    db
      .select({ status: starMints.status })
      .from(starMints)
      .where(eq(starMints.userId, user.id)),
    db
      .select({ id: repos.id, fullName: repos.fullName, status: repos.status })
      .from(repos)
      .where(eq(repos.postedByUserId, user.id))
      .orderBy(desc(repos.createdAt)),
  ]);

  return ok({
    creditBalance: user.creditBalance,
    mintEligible: user.mintEligible,
    claims: {
      today: usage.day,
      thisWeek: usage.week,
      dailyCap: DAILY_MINT_CAP,
      weeklyCap: WEEKLY_MINT_CAP,
      // Revoked mints stay in the table forever (the unique index is what
      // blocks re-minting), so "stars claimed" has to exclude them or the
      // number only ever goes up.
      total: claimed.filter((m) => m.status === "minted").length,
    },
    entries: entries.map((e) => ({
      id: e.id,
      delta: e.delta,
      type: e.type,
      label: TYPE_LABELS[e.type] ?? e.type,
      memo: e.memo,
      createdAt: e.createdAt,
    })),
    postedRepos: posted.filter((r) => r.status !== "removed"),
  });
}
