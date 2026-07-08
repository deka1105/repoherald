"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { supportTickets, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { log } from "@/lib/log";

export type SupportState = { error?: string; success?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitSupportTicket(
  _prev: SupportState,
  formData: FormData
): Promise<SupportState> {
  const session = await auth();

  // Prefer the account email for logged-in users; fall back to the field.
  let userId: string | null = null;
  let email = String(formData.get("email") ?? "").trim();
  if (session?.user?.id) {
    userId = session.user.id;
    const acct = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { email: true },
    });
    if (acct?.email) email = acct.email;
  }

  if (!EMAIL_RE.test(email)) {
    return { error: "Enter a valid email so we can reply." };
  }

  const subject = String(formData.get("subject") ?? "").trim().slice(0, 150);
  const message = String(formData.get("message") ?? "").trim();
  if (message.length < 10) {
    return { error: "Please describe your question in a bit more detail." };
  }

  const [inserted] = await db
    .insert(supportTickets)
    .values({
      userId,
      email,
      subject: subject || null,
      message: message.slice(0, 5000),
    })
    .returning({ id: supportTickets.id });

  await writeAudit(db, {
    actorUserId: userId,
    actorType: "user",
    action: "support.submit",
    entityType: "support_ticket",
    entityId: inserted.id,
  });
  log.info("support.submitted", { ticketId: inserted.id, userId });

  return {
    success: "Thanks — your message is in. We'll reply by email.",
  };
}
