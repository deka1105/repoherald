import { createSupportTicket } from "@/lib/support-ticket";
import { fail, jsonBody, mobileUser, ok } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/**
 * File a support ticket from the app.
 *
 * Open to anonymous senders, like the web form — someone who cannot sign in
 * is exactly the person most likely to be writing. A signed-in sender's
 * account email wins over the field; see `createSupportTicket`.
 */
export async function POST(req: Request) {
  const body = await jsonBody(req);
  if (!body) return fail("Malformed body", 400);

  const user = await mobileUser(req);

  const result = await createSupportTicket({
    userId: user?.id ?? null,
    email: typeof body.email === "string" ? body.email : "",
    subject: typeof body.subject === "string" ? body.subject : "",
    message: typeof body.message === "string" ? body.message : "",
  });

  // 422: well-formed request, rejected by a content rule.
  if (result.error) return fail(result.error, 422);
  return ok({ submitted: true, message: result.success }, { status: 201 });
}
