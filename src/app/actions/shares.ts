"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { socialShares } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { log } from "@/lib/log";
import { PLATFORM_DOMAINS, normalizeShareUrl } from "@/lib/shares";

export type ShareState = { error?: string; success?: string };

export async function submitSocialShare(
  _prev: ShareState,
  formData: FormData
): Promise<ShareState> {
  const user = await requireUser();

  const eligible =
    user.eligibilityOverride === "allowed" ||
    (user.eligibilityOverride !== "blocked" && user.mintEligible);
  if (!eligible) {
    return {
      error: "Your account doesn't meet the requirements to earn rewards yet.",
    };
  }

  const platform = String(formData.get("platform") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  const domains = PLATFORM_DOMAINS[platform];
  if (!domains) return { error: "Pick a platform." };

  const normalized = normalizeShareUrl(url);
  if (!normalized) return { error: "That doesn't look like a valid URL." };
  const host = normalized.split("/")[0];
  if (!domains.some((d) => host === d || host.endsWith(`.${d}`))) {
    return { error: `That URL isn't a ${platform} post.` };
  }
  if (normalized.split("/").length < 2) {
    return { error: "Link the specific post, not the site homepage." };
  }

  const existing = await db.query.socialShares.findFirst({
    where: and(
      eq(socialShares.userId, user.id),
      eq(socialShares.platform, platform as never),
      inArray(socialShares.status, ["pending", "approved"])
    ),
  });
  if (existing) {
    return {
      error: `You already have a ${existing.status} submission for this platform — one reward per platform.`,
    };
  }

  const [inserted] = await db
    .insert(socialShares)
    .values({
      userId: user.id,
      platform: platform as never,
      url,
      urlNormalized: normalized,
    })
    .onConflictDoNothing({ target: socialShares.urlNormalized })
    .returning({ id: socialShares.id });

  if (!inserted) {
    return { error: "This URL has already been submitted." };
  }

  await writeAudit(db, {
    actorUserId: user.id,
    actorType: "user",
    action: "share.submit",
    entityType: "social_share",
    entityId: inserted.id,
    metadata: { platform, url },
  });
  log.info("share.submitted", { userId: user.id, platform, shareId: inserted.id });

  revalidatePath("/wallet");
  return {
    success:
      "Submitted! An admin will review it — keep the post up for 7 days to receive your credit.",
  };
}
