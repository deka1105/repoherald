import { searchRepos } from "@/lib/search";
import { mobileUser, ok } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/**
 * Search, with the same two-source privacy rule as the web.
 *
 * `searchRepos` returns public listings plus anything in a list the caller
 * OWNS — which is how a repo filed from a DM (written `hidden`, so invisible
 * in the public half) is findable by the person who sent it and nobody else.
 * Signed out, the token resolves to null and only the public half runs; that
 * is a supported state, not an error, so there is no 401 here.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const user = await mobileUser(req);

  const hits = await searchRepos(q, user?.id ?? null);

  return ok({
    query: q,
    // Flattened and trimmed: the raw hit carries the whole `repos` row, which
    // includes columns (status, removedReason, githubRepoId) the app has no
    // use for and that should not become part of a public response shape.
    results: hits.map((h) => ({
      id: h.repo.id,
      fullName: h.repo.fullName,
      description: h.repo.description,
      primaryLanguage: h.repo.primaryLanguage,
      starsCount: h.repo.starsCount,
      avatarUrl: h.repo.avatarUrl,
      isArchived: h.repo.isArchived,
      where: h.where,
      listSlug: h.listSlug,
      listTitle: h.listTitle,
    })),
  });
}
