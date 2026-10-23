"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/authz";
import { claimStarFor, type ClaimResult } from "@/lib/claim";

export type ClaimState = ClaimResult;

export async function claimStar(repoId: string): Promise<ClaimState> {
  const user = await requireUser();
  const result = await claimStarFor(user, repoId);
  // Revalidate even on failure: the caps line on the repo page and the wallet
  // both read usage counters that a *rejected* attempt can still have moved.
  revalidatePath(`/repos/${repoId}`);
  revalidatePath("/wallet");
  return result;
}
