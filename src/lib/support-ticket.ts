/**
 * Filing a support ticket, shared by the web form and the mobile API.
 *
 * The email rule is the interesting part: for a signed-in person the account
 * email wins over whatever is in the field, because a reply that goes to a
 * typo'd address is worse than no reply at all. Signed out, the field is all
 * there is — so support has to stay open to anonymous senders, which is also
 * what makes it usable by someone who cannot sign in and is writing to say so.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { supportTickets, users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { log } from "@/lib/log";
import { notifySupportTicket } from "@/lib/notify";

export type SupportResult = { error?: string; success?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGE_MIN = 10;
const SUBJECT_MAX = 150;
const MESSAGE_MAX = 5000;

export async function createSupportTicket(input: {
  userId: string | null;
  /** Ignored when the account has an email of its own. */
  email: string;
  subject: string;
  message: string;
}): Promise<SupportResult> {
  let email = input.email.trim();
  if (input.userId) {
    const acct = await db.query.users.findFirst({
      where: eq(users.id, input.userId),
      columns: { email: true },
    });
    if (acct?.email) email = acct.email;
  }

  if (!EMAIL_RE.test(email)) {
    return { error: "Enter a valid email so we can reply." };
  }

  const subject = input.subject.trim().slice(0, SUBJECT_MAX);
  const message = input.message.trim();
  if (message.length < MESSAGE_MIN) {
    return { error: "Please describe your question in a bit more detail." };
  }

  const [inserted] = await db
    .insert(supportTickets)
    .values({
      userId: input.userId,
      email,
      subject: subject || null,
      message: message.slice(0, MESSAGE_MAX),
    })
    .returning({ id: supportTickets.id });

  await writeAudit(db, {
    actorUserId: input.userId,
    actorType: "user",
    action: "support.submit",
    entityType: "support_ticket",
    entityId: inserted.id,
  });
  log.info("support.submitted", { ticketId: inserted.id, userId: input.userId });

  // Awaited, not fired and forgotten: on serverless the function can be frozen
  // the moment the caller returns, and a dangling promise is simply dropped.
  // notifySupportTicket swallows its own failures, so this cannot fail the
  // submission the person has already been told succeeded.
  await notifySupportTicket({
    ticketId: inserted.id,
    fromEmail: email,
    subject: subject || null,
    message,
  });

  return { success: "Thanks — your message is in. We'll reply by email." };
}
