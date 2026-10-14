import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

/**
 * Site-wide switches an admin can flip without a deploy.
 *
 * `app_settings.value` is an integer column, so booleans live here as 0/1.
 * Every flag states its default, and the default is always "behave the way the
 * site behaved before the flag existed" — a missing row, an unmigrated
 * database, or a failed query must never silently change what visitors see.
 */
export const FLAGS = {
  /**
   * Post repos from repoHeraldIG automatically instead of waiting for a
   * moderator to press Approve. OFF by default: listing a stranger's repo
   * under a real person's name is not something a default should decide.
   */
  ingestAutoPost: { key: "ingest_auto_post", default: false },
  /**
   * Whether sponsorship is on offer at all. ON by default so that enabling the
   * flag is what changes the site, not installing it.
   */
  sponsorshipsEnabled: { key: "sponsorships_enabled", default: true },
} as const;

export type FlagName = keyof typeof FLAGS;

// Read on nearly every render (the chrome checks sponsorship on each page), so
// a short cache keeps it off the hot path. 30s matches getClaimCaps — long
// enough to matter, short enough that an admin flipping a switch sees it take
// effect while they are still looking at the page.
const TTL_MS = 30_000;
let cache: { at: number; values: Record<string, number> } | null = null;

async function readAll(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.values;
  const values: Record<string, number> = {};
  try {
    for (const row of await db.select().from(appSettings)) {
      values[row.key] = row.value;
    }
    cache = { at: Date.now(), values };
  } catch {
    // An unreachable settings table must not take the site down, and must not
    // flip a flag either: fall through to the declared defaults.
    return {};
  }
  return values;
}

export function invalidateFlagCache() {
  cache = null;
}

export async function getFlag(name: FlagName): Promise<boolean> {
  const flag = FLAGS[name];
  const values = await readAll();
  const raw = values[flag.key];
  return raw === undefined ? flag.default : raw !== 0;
}

export async function getFlags(): Promise<Record<FlagName, boolean>> {
  const values = await readAll();
  const out = {} as Record<FlagName, boolean>;
  for (const [name, flag] of Object.entries(FLAGS) as [
    FlagName,
    (typeof FLAGS)[FlagName],
  ][]) {
    const raw = values[flag.key];
    out[name] = raw === undefined ? flag.default : raw !== 0;
  }
  return out;
}

export async function setFlag(name: FlagName, on: boolean) {
  const { key } = FLAGS[name];
  await db
    .insert(appSettings)
    .values({ key, value: on ? 1 : 0, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: on ? 1 : 0, updatedAt: new Date() },
    });
  invalidateFlagCache();
}
