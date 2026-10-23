"use server";

import { auth } from "@/auth";
import { createSupportTicket, type SupportResult } from "@/lib/support-ticket";

export type SupportState = SupportResult;

export async function submitSupportTicket(
  _prev: SupportState,
  formData: FormData
): Promise<SupportState> {
  const session = await auth();

  return createSupportTicket({
    userId: session?.user?.id ?? null,
    email: String(formData.get("email") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    message: String(formData.get("message") ?? ""),
  });
}
