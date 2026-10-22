/**
 * Blocked owners, kept on the device.
 *
 * App Store Guideline 1.2 wants a way to block abusive users as well as a way
 * to report content. Blocking lives on the device rather than on the server
 * for two reasons: browsing needs no account, so there is often no server-side
 * "you" to hang a block list on; and a block list is a record of who someone
 * dislikes, which is not a thing this app should be collecting when it does
 * not have to. The feed is filtered client-side instead.
 *
 * `expo-secure-store` is already a dependency (it holds the bearer token), so
 * this adds no new native module. The values are not secret — this is just the
 * storage the app already has.
 */
import * as SecureStore from "expo-secure-store";

const KEY = "blocked_owners_v1";

/** Owner logins, lower-cased. Comparison is case-insensitive everywhere. */
export type BlockedOwners = string[];

function normalise(owner: string) {
  return owner.trim().toLowerCase();
}

export async function loadBlocked(): Promise<BlockedOwners> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    // A corrupt or unreadable store must not stop the feed from rendering.
    return [];
  }
}

async function save(list: BlockedOwners) {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(list));
  } catch {
    // Nothing useful to tell the user here; the in-memory list still applies
    // for this session.
  }
}

export async function blockOwner(owner: string): Promise<BlockedOwners> {
  const next = await loadBlocked();
  const o = normalise(owner);
  if (!o || next.includes(o)) return next;
  const updated = [...next, o];
  await save(updated);
  return updated;
}

export async function unblockOwner(owner: string): Promise<BlockedOwners> {
  const current = await loadBlocked();
  const o = normalise(owner);
  const updated = current.filter((x) => x !== o);
  await save(updated);
  return updated;
}

/** `fullName` is "owner/name" — the only name the feed API sends. */
export function ownerOf(fullName: string) {
  return normalise(fullName.split("/")[0] ?? fullName);
}

export function isBlocked(fullName: string, blocked: BlockedOwners) {
  return blocked.includes(ownerOf(fullName));
}
