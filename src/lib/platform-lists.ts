import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { repoLists, users } from "@/db/schema";
import { newSlug } from "@/lib/lists";

export type Platform = "instagram" | "tiktok";

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};

export const HANDLE_COLUMN = {
  instagram: users.instagramUsername,
  tiktok: users.tiktokUsername,
} as const;

/**
 * Handles are stored lowercase with no leading "@" and no surrounding URL, so
 * that what a user types matches what the scraper recorded. Returns null for
 * anything that is not a plausible handle rather than storing a mangled one.
 *
 * Instagram allows letters, digits, periods and underscores (max 30). TikTok is
 * the same set (max 24). The looser of the two is used, since rejecting a valid
 * handle is worse here than accepting one that simply never matches anything.
 */
export function normaliseHandle(raw: string): string | null {
  let v = raw.trim().toLowerCase();
  if (!v) return null;
  // Accept a pasted profile URL as well as a bare handle.
  const url = v.match(/(?:instagram\.com|tiktok\.com)\/+@?([a-z0-9._]+)/);
  if (url) v = url[1];
  v = v.replace(/^@+/, "").replace(/\/+$/, "");
  if (!/^[a-z0-9._]{1,30}$/.test(v)) return null;
  return v;
}

/**
 * The private list that a platform's finds are filed into, created on demand.
 *
 * Private, not unlisted: it holds what somebody sent from their own DMs, which
 * is closer to a reading pile than to something they published. Contributions
 * are closed for the same reason — it is theirs.
 *
 * Idempotent, and safe against two concurrent calls: the partial unique index
 * on (owner_user_id, source) makes a duplicate insert fail rather than produce
 * a second list, and the conflict path re-reads the winner.
 */
export async function ensurePlatformList(
  userId: string,
  platform: Platform
): Promise<{ id: string; slug: string }> {
  const [existing] = await db
    .select({ id: repoLists.id, slug: repoLists.slug })
    .from(repoLists)
    .where(and(eq(repoLists.ownerUserId, userId), eq(repoLists.source, platform)))
    .limit(1);
  if (existing) return existing;

  const title = `${PLATFORM_LABEL[platform]} finds`;
  const [created] = await db
    .insert(repoLists)
    .values({
      ownerUserId: userId,
      slug: newSlug(title),
      title,
      description: `Repositories spotted in your ${PLATFORM_LABEL[platform]} messages.`,
      contributions: "closed",
      visibility: "private",
      source: platform,
    })
    .onConflictDoNothing()
    .returning({ id: repoLists.id, slug: repoLists.slug });

  if (created) return created;

  const [raced] = await db
    .select({ id: repoLists.id, slug: repoLists.slug })
    .from(repoLists)
    .where(and(eq(repoLists.ownerUserId, userId), eq(repoLists.source, platform)))
    .limit(1);
  if (!raced) throw new Error("Could not create the platform list.");
  return raced;
}

/** The account that has claimed this handle on this platform, if any. */
export async function userForHandle(
  platform: Platform,
  handle: string
): Promise<{ id: string } | null> {
  const normalised = normaliseHandle(handle);
  if (!normalised) return null;
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(HANDLE_COLUMN[platform], normalised))
    .limit(1);
  return row ?? null;
}
