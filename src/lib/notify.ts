import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { repos, sponsorships, users } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { esc, renderSponsorAlert } from "@/lib/email-templates";
import { log } from "@/lib/log";
import { unsubscribeUrl } from "@/lib/unsubscribe";

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
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users.sponsorAlertsOptIn, true), isNotNull(users.email)));

    const recipients = subscribers.filter(
      (s): s is { id: string; email: string } => Boolean(s.email)
    );
    if (recipients.length === 0) {
      log.info("notify.sponsor.no_subscribers", { sponsorshipId });
      return;
    }

    // Send individually so one recipient can't see the others (BCC-free), and
    // so each gets an unsubscribe link signed for their own account.
    let sent = 0;
    for (const recipient of recipients) {
      const unsubscribe = unsubscribeUrl(recipient.id);
      if (!unsubscribe) log.warn("notify.sponsor.no_unsubscribe_link", { reason: "AUTH_SECRET unset" });
      const { subject, html, text } = renderSponsorAlert({
        fullName: row.fullName,
        description: row.description,
        primaryLanguage: row.primaryLanguage,
        starsCount: row.starsCount,
        avatarUrl: row.avatarUrl,
        repoUrl: appUrl(`/repos/${row.repoId}`),
        unsubscribeUrl: unsubscribe ?? undefined,
      });
      const ok = await sendEmail({
        to: recipient.email,
        subject,
        html,
        text,
        // RFC 8058: lets Gmail/Outlook show their own one-click unsubscribe,
        // which many people use instead of scrolling to the footer link.
        headers: unsubscribe
          ? {
              "List-Unsubscribe": `<${unsubscribe}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
          : undefined,
      });
      if (ok) sent += 1;
    }
    log.info("notify.sponsor.done", { sponsorshipId, recipients: recipients.length, sent });
  } catch (e) {
    log.error("notify.sponsor.error", e, { sponsorshipId });
  }
}

/**
 * Tell the operator that someone filed a support ticket.
 *
 * Without this a ticket lands in a table and waits for somebody to think to
 * look at /admin/support, which is the same as not having support.
 *
 * Best-effort in the strict sense: the person has already been told their
 * message is in, and it is. A mail failure must not turn that into an error on
 * their screen, so everything here is caught and logged.
 *
 * Unset OPERATOR_EMAIL means no notification. That is the right default rather
 * than an oversight — before anyone is actually reading an inbox, a silent
 * no-op beats mail piling up unread somewhere nobody has opened.
 */
export async function notifySupportTicket(input: {
  ticketId: string;
  fromEmail: string;
  subject: string | null;
  message: string;
}): Promise<void> {
  const operator = process.env.OPERATOR_EMAIL?.trim();
  if (!operator) {
    log.info("notify.support.skipped_no_operator", { ticketId: input.ticketId });
    return;
  }

  try {
    const subject = input.subject?.trim() || "(no subject)";
    const adminUrl = appUrl("/admin/support");
    const ok = await sendEmail({
      to: operator,
      subject: `Support: ${subject}`,
      html:
        `<p><strong>${esc(subject)}</strong></p>` +
        `<p style="white-space:pre-wrap">${esc(input.message)}</p>` +
        `<p>— ${esc(input.fromEmail)}<br>` +
        `<a href="${adminUrl}">Open in admin</a></p>`,
      text: `${subject}\n\n${input.message}\n\n— ${input.fromEmail}\n${adminUrl}`,
      // So replying in a mail client answers the person, not the robot.
      replyTo: input.fromEmail,
    });
    log.info("notify.support.done", { ticketId: input.ticketId, sent: ok });
  } catch (e) {
    log.error("notify.support.error", e, { ticketId: input.ticketId });
  }
}
