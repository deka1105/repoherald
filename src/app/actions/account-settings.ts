"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { repos } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";

/**
 * Owner unlist/relist of their own listing (active ↔ hidden). Fully reversible.
 * Refuses admin-'removed' listings — those stay a moderation decision.
 */
export async function setRepoListed(repoId: string, listed: boolean) {
  const user = await requireUser();
  const repo = await db.query.repos.findFirst({ where: eq(repos.id, repoId) });
  if (!repo || repo.postedByUserId !== user.id) {
    throw new Error("That isn't one of your listings.");
  }
  if (repo.status === "removed") {
    throw new Error("This listing was removed by moderation and can't be relisted.");
  }

  const next = listed ? "active" : "hidden";
  if (repo.status === next) return;

  await db.update(repos).set({ status: next }).where(eq(repos.id, repoId));
  await writeAudit(db, {
    actorUserId: user.id,
    actorType: "user",
    action: listed ? "listing.relist" : "listing.unlist",
    entityType: "repo",
    entityId: repoId,
    metadata: { fullName: repo.fullName },
  });

  revalidatePath("/");
  revalidatePath("/account");
}
