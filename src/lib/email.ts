import { log } from "@/lib/log";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

/**
 * Send transactional email via the Resend HTTP API. Uses fetch (no SDK
 * dependency) so it runs on any runtime. When RESEND_API_KEY / EMAIL_FROM are
 * unset it no-ops with a log line instead of throwing — keeps dev, build, and
 * webhook processing working before email is fully configured.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const recipients = Array.isArray(input.to) ? input.to : [input.to];

  if (!apiKey || !from) {
    log.warn("email.skipped_unconfigured", {
      subject: input.subject,
      recipients: recipients.length,
    });
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.error("email.send_failed", new Error(`Resend ${res.status}`), {
        subject: input.subject,
        body: body.slice(0, 500),
      });
      return false;
    }
    log.info("email.sent", { subject: input.subject, recipients: recipients.length });
    return true;
  } catch (e) {
    log.error("email.send_error", e, { subject: input.subject });
    return false;
  }
}
