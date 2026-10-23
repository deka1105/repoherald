import { revalidatePath } from "next/cache";
import { postRepoFor, REPO_POSTS_PER_DAY } from "@/lib/post-repo";
import { fail, jsonBody, mobileUser, ok, unauthenticated } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/**
 * List a repo from the app.
 *
 * All the rules — the daily cap, the public-repo check and above all the
 * owner/org-member check — live in `postRepoFor`, which the web form calls
 * too. The ownership rule is the one that must never be bypassable from a
 * second client: it is what stops anyone listing someone else's project.
 */
export async function POST(req: Request) {
  const user = await mobileUser(req);
  if (!user) return unauthenticated();

  const body = await jsonBody(req);
  if (!body) return fail("Malformed body", 400);

  const categoryIds = Array.isArray(body.categoryIds)
    ? body.categoryIds.filter((v): v is string => typeof v === "string" && Boolean(v))
    : [];

  const result = await postRepoFor(user, {
    url: typeof body.url === "string" ? body.url : "",
    categoryIds,
    newUseCases: typeof body.newUseCases === "string" ? body.newUseCases : "",
    newSectors: typeof body.newSectors === "string" ? body.newSectors : "",
  });

  if ("error" in result) return fail(result.error, 422);

  revalidatePath("/");
  return ok({ repoId: result.repoId }, { status: 201 });
}

/** Surfaced so the app can state the cap before someone hits it. */
export async function GET() {
  return ok({ postsPerDay: REPO_POSTS_PER_DAY });
}
