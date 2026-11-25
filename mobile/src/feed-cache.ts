/**
 * The last Explore page the app saw, kept on disk so a cold start on a bad
 * connection shows the feed instead of a spinner and then an error.
 *
 * Only the default-sorted first page is cached — that is what a launch shows.
 * It is public data (the same listings anyone sees signed out), so it goes in
 * the cache directory, which the OS may purge whenever it likes; nothing here
 * is worth backing up or protecting.
 *
 * Every function swallows errors: a cache that cannot be read is a cache miss.
 */
import { File, Paths } from "expo-file-system";
import type { FeedRepo } from "./api";

const VERSION = 1;
const file = () => new File(Paths.cache, "explore-feed.json");

export function readCachedFeed(): FeedRepo[] | null {
  try {
    const f = file();
    if (!f.exists) return null;
    const parsed: unknown = JSON.parse(f.textSync());
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as { v?: unknown }).v === VERSION &&
      Array.isArray((parsed as { items?: unknown }).items)
    ) {
      return (parsed as { items: FeedRepo[] }).items;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCachedFeed(items: FeedRepo[]): void {
  try {
    const f = file();
    if (!f.exists) f.create();
    f.write(JSON.stringify({ v: VERSION, items }));
  } catch {
    // A miss next launch, nothing more.
  }
}
