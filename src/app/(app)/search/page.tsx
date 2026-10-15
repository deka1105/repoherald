import Link from "next/link";
import { auth } from "@/auth";
import { searchRepos } from "@/lib/search";
import { RepoCard } from "@/components/repo-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata = {
  title: "Search — repoherald",
  description: "Find the repo you saved and forgot about.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const session = await auth();
  const query = q.trim();
  const hits = await searchRepos(query, session?.user?.id ?? null);

  const saved = hits.filter((h) => h.where === "list");
  const listed = hits.filter((h) => h.where === "public");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {session?.user
            ? "Everything you've saved, plus everything listed here."
            : "Everything listed here. Sign in to search what you've sent us too."}
        </p>
      </div>

      {/* A plain GET form: the query lives in the URL, so a search is a link
          somebody can bookmark or send to a colleague. */}
      <form action="/search" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={query}
          placeholder="react, rust, scraper, that 3D thing…"
          autoComplete="off"
          aria-label="Search repositories"
          className="min-w-0 flex-1 basis-64"
        />
        <Button type="submit" size="sm">
          Search
        </Button>
      </form>

      {query.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Type a name, a language, or anything from the description.
        </p>
      ) : query.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          A little more to go on — two characters minimum.
        </p>
      ) : hits.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm">
            Nothing matches <strong>{query}</strong>.
          </p>
          {!session?.user && (
            <p className="text-sm text-muted-foreground">
              If you sent it to us from Instagram, sign in and claim your handle
              — your finds are private, so they only appear when you&apos;re
              signed in.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {saved.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Yours — {saved.length} {saved.length === 1 ? "result" : "results"}
              </h2>
              {saved.map((h) => (
                <div key={h.repo.id} className="space-y-1">
                  <RepoCard repo={h.repo} />
                  {h.listSlug && (
                    <p className="text-xs text-muted-foreground">
                      in{" "}
                      <Link
                        href={`/lists/${h.listSlug}`}
                        className="underline underline-offset-2"
                      >
                        {h.listTitle}
                      </Link>
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}

          {listed.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                Listed on repoherald
                <Badge variant="outline">{listed.length}</Badge>
              </h2>
              {listed.map((h) => (
                <RepoCard key={h.repo.id} repo={h.repo} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
