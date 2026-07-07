"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/authz";
import { CreditError, spendCredit } from "@/lib/credits";

export type SpendState = { error?: string; success?: string };

export async function spendOnHighlight(
  repoId: string,
  kind: "self" | "donation"
): Promise<SpendState> {
  const user = await requireUser();
  try {
    await spendCredit(user.id, repoId, kind);
  } catch (e) {
    if (e instanceof CreditError) return { error: e.message };
    throw e;
  }
  revalidatePath("/");
  revalidatePath("/wallet");
  revalidatePath(`/repos/${repoId}`);
  return {
    success:
      kind === "self"
        ? "1 hour of highlight queued for your repo."
        : "15 minutes of highlight donated.",
  };
}
