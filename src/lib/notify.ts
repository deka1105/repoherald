import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { repos, sponsorships, users } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { renderSponsorAlert } from "@/lib/email-templates";
import { log } from "@/lib/log";

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://repoherald.com";
  return `${base}${path}`;
}

/**
 * Email opted-in users that a new sponsored repo just went live. Best-effort:
 * failures are logged, never thrown — this is called from the Stripe webhook
 * and must not break payment processing.
 *
 * NOTE: the subject/body below are a placeholder template — swap the copy once
 * the final email details are provided.
 */
export async function notifySponsorshipActivated(sponsorshipId: string): Promise<void> {
  try {
    const [row] = await db
      .select({
        repoId: repos.id,
        fullName: repos.fullName,
        description: repos.description,
        primaryLanguage: repos.primaryLanguage,
        starsCount: repos.starsCount,
        avatarUrl: repos.avatarUrl,
      })
      .from(sponsorships)
      .innerJoin(repos, eq(sponsorships.repoId, repos.id))
      .where(eq(sponsorships.id, sponsorshipId));
    if (!row) {
      log.warn("notify.sponsor.no_repo", { sponsorshipId });
      return;
    }

    const subscribers = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.sponsorAlertsOptIn, true), isNotNull(users.email)));

    const recipients = subscribers
      .map((s) => s.email)
      .filter((e): e is string => Boolean(e));
    if (recipients.length === 0) {
      log.info("notify.sponsor.no_subscribers", { sponsorshipId });
      return;
    }

    const { subject, html, text } = renderSponsorAlert({
      fullName: row.fullName,
      description: row.description,
      primaryLanguage: row.primaryLanguage,
      starsCount: row.starsCount,
      avatarUrl: row.avatarUrl,
      repoUrl: appUrl(`/repos/${row.repoId}`),
    });

    // Send individually so one recipient can't see the others (BCC-free).
    let sent = 0;
    for (const to of recipients) {
      if (await sendEmail({ to, subject, html, text })) sent += 1;
    }
    log.info("notify.sponsor.done", { sponsorshipId, recipients: recipients.length, sent });
  } catch (e) {
    log.error("notify.sponsor.error", e, { sponsorshipId });
  }
}
