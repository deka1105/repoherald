"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { repos, reports } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { postRepoFor } from "@/lib/post-repo";

export type PostRepoState = { error?: string };

export async function postRepo(
  _prev: PostRepoState,
  formData: FormData
): Promise<PostRepoState> {
  const user = await requireUser();

  const result = await postRepoFor(user, {
    url: String(formData.get("url") ?? ""),
    categoryIds: formData.getAll("categoryIds").map(String).filter(Boolean),
    newUseCases: String(formData.get("newUseCases") ?? ""),
    newSectors: String(formData.get("newSectors") ?? ""),
  });

  if ("error" in result) return { error: result.error };

  revalidatePath("/");
  redirect(`/repos/${result.repoId}`);
}

export async function reportRepo(repoId: string, reason: string) {
  const user = await requireUser();
  const repo = await db.query.repos.findFirst({ where: eq(repos.id, repoId) });
  if (!repo) throw new Error("Repo not found");
  await db.insert(reports).values({
    repoId,
    reporterUserId: user.id,
    reason: reason.slice(0, 500) || "No reason given",
  });
  await writeAudit(db, {
    actorUserId: user.id,
    actorType: "user",
    action: "listing.report",
    entityType: "repo",
    entityId: repoId,
  });
}
