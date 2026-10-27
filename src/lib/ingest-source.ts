import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { ingestRepoCandidates, ingestSightings } from "@/db/schema";

/**
 * Where a listing was spotted: the post it came out of.
 *
 * Deliberately carries **no usernames.** `ingest_sightings` also holds
 * `sender_username` and `poster_username`, which are personal data about people
 * who never signed up here — /privacy says in terms that those are never
 * published, and the only way to keep that true is for the published shape not
 * to have somewhere to put them. The post itself is public content on the
 * platform it lives on; who forwarded it is not.
 */
export type RepoSource = {
  platform: "instagram" | "tiktok" | "x" | "reddit" | "facebook";
  postUrl: string;
  /**
   * Where in the post the repo was named — caption, on-screen text, narration.
   *
   * Typed as a plain string, not the schema's union, on purpose. Drizzle's
   * `text({ enum })` is a compile-time type only — it writes no CHECK
   * constraint — and production already holds `"caption-cue"`, which the union
   * does not list. Anything rendering this must tolerate a value it has never
   * heard of rather than trusting the union and printing `undefined`.
   */
  foundIn: string | null;
};

/**
 * The source post for each of `repoIds` that has one.
 *
 * Repos reach `repos` two ways: their owner posts them, or a moderator promotes
 * an ingest candidate. Only the second has a source, so this returns a sparse
 * map and callers render nothing for a repo that is absent — an owner-posted
 * repo has no reel behind it and must not imply one.
 *
 * A candidate can hold several sightings, because a repo three people sent you
 * is different from one mentioned once. This takes the earliest: the post that
 * first brought it here, which is the one "source" should mean.
 */
export async function getRepoSources(
  repoIds: string[]
): Promise<Map<string, RepoSource>> {
  const out = new Map<string, RepoSource>();
  // inArray with an empty list builds invalid SQL rather than matching nothing.
  if (repoIds.length === 0) return out;

  const rows = await db
    .select({
      repoId: ingestRepoCandidates.promotedRepoId,
      platform: ingestRepoCandidates.platform,
      postUrl: ingestSightings.postUrl,
      foundIn: ingestSightings.foundIn,
    })
    .from(ingestRepoCandidates)
    .innerJoin(
      ingestSightings,
      eq(ingestSightings.candidateId, ingestRepoCandidates.id)
    )
    .where(inArray(ingestRepoCandidates.promotedRepoId, repoIds))
    // Earliest first, so the first row seen per repo is the one kept below.
    .orderBy(asc(ingestSightings.createdAt));

  for (const r of rows) {
    if (!r.repoId || out.has(r.repoId)) continue;
    out.set(r.repoId, {
      platform: r.platform,
      postUrl: r.postUrl,
      foundIn: r.foundIn,
    });
  }
  return out;
}
