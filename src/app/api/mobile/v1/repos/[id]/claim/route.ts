import { revalidatePath } from "next/cache";
import { claimStarFor } from "@/lib/claim";
import { fail, mobileUser, ok, unauthenticated } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/**
 * Claim the credit for a star, from the app.
 *
 * All the rules live in `claimStarFor`, which the web action calls too — the
 * caps, the self-star refusal and the "this star predates the listing" check
 * must not be able to differ between platforms, because they are what stops
 * the ledger being farmed.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await mobileUser(req);
  if (!user) return unauthenticated();

  const result = await claimStarFor(user, id);

  // Revalidate either way: a rejected attempt can still have moved the usage
  // counters the repo page and the wallet both render.
  revalidatePath(`/repos/${id}`);
  revalidatePath("/wallet");

  // 422 rather than 400: the request was well-formed, the claim was refused.
  if (result.error) return fail(result.error, 422);
  return ok({ claimed: true, message: result.success });
}
