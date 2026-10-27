import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, X } from "lucide-react";
import { auth } from "@/auth";
import { deleteList, removeListItem, updateList } from "@/app/actions/lists";
import { RepoCard } from "@/components/repo-card";
import { ShareLink } from "@/components/share-link";
import { ViewStats } from "@/components/view-stats";
import { getListViewStats } from "@/lib/view-stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  getListBySlug,
  getListItems,
} from "@/lib/lists";
import { getRepoSources, type RepoSource } from "@/lib/ingest-source";
import { AddRepoForm } from "./add-repo-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = await getListBySlug(slug);
  if (!row || row.list.status !== "active") return { title: "List — repoherald" };
  // A private list's title is private too. generateMetadata runs without the
  // page's viewer check, so it must not describe what it cannot authorise.
  if (row.list.visibility === "private") return { title: "List — repoherald" };
  return {
    title: `${row.list.title} — repoherald`,
    description:
      row.list.description ??
      `A repo list curated by ${row.ownerLogin ?? "a member"}.`,
  };
}

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { slug } = await params;
  const { msg, err } = await searchParams;
  const session = await auth();

  const row = await getListBySlug(slug);
  if (!row) notFound();
  const { list, ownerLogin } = row;

  const isStaff =
    session?.user?.role === "admin" || session?.user?.role === "moderator";
  // A removed list stays visible to staff so they can restore it.
  if (list.status === "removed" && !isStaff) notFound();

  const isOwner = session?.user?.id === list.ownerUserId;
  // "unlisted" is link-shareable by design; "private" is not. 404 rather than
  // 403 so the response does not confirm the slug exists.
  if (list.visibility === "private" && !isOwner && !isStaff) notFound();

  const canAdd = Boolean(session?.user) && (list.contributions === "open" || isOwner);
  const [items, views] = await Promise.all([
    getListItems(list.id),
    getListViewStats(list.slug),
  ]);
  // Source posts are shown to the owner and staff only, never to a visitor
  // holding a link.
  //
  // The lists these repos actually land in are `visibility: "private"`, so for
  // them this gate is belt-and-braces. It matters for the other case: nothing
  // stops someone adding one of these hidden repos to an *unlisted* list,
  // which is readable by anyone with the URL, and that would publish a third
  // party's post link — the one thing the landing page promises we never do.
  // Skipping the query entirely also spares a visitor's page load a join.
  //
  // One query for the whole page rather than one per card. Needs the item ids,
  // so it cannot join the Promise.all above.
  const sources =
    isOwner || isStaff
      ? await getRepoSources(items.map((i) => i.repo.id))
      : new Map<string, RepoSource>();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{list.title}</h1>
          {list.contributions === "closed" && (
            <Badge variant="outline" className="font-normal">
              <Lock className="mr-1 size-3" /> Closed
            </Badge>
          )}
          {list.status === "removed" && <Badge variant="destructive">Removed</Badge>}
        </div>
        {list.description && (
          <p className="mt-1 text-muted-foreground">{list.description}</p>
        )}
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span>
            Curated by {ownerLogin} · {items.length}{" "}
            {items.length === 1 ? "repo" : "repos"}
          </span>
          <ViewStats stats={views} />
        </p>
      </div>

      {msg && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{msg}</p>
      )}
      {err && <p className="text-sm text-destructive">{err}</p>}

      <ShareLink path={`/lists/${list.slug}`} />

      {canAdd ? (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">Add a repo</p>
          <AddRepoForm slug={list.slug} />
          <p className="text-xs text-muted-foreground">
            Repos must already be listed on repoherald.{" "}
            <Link href="/post" className="underline underline-offset-2">
              Post one
            </Link>{" "}
            if it isn&apos;t (only its owner can).
          </p>
        </div>
      ) : (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">
          {session?.user
            ? "The owner has closed this list to new additions."
            : "Sign in with GitHub to add repos to this list."}
        </p>
      )}

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing here yet — this list is waiting for its first repo.
          </p>
        ) : (
          items.map((item) => {
            const canRemove =
              isOwner || isStaff || session?.user?.id === item.addedByUserId;
            return (
              <div key={item.itemId} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <RepoCard
                    repo={{
                      id: item.repo.id,
                      fullName: item.repo.fullName,
                      description: item.repo.description,
                      primaryLanguage: item.repo.primaryLanguage,
                      starsCount: item.repo.starsCount,
                      avatarUrl: item.repo.avatarUrl,
                      isArchived: item.repo.isArchived,
                      source: sources.get(item.repo.id),
                    }}
                  />
                  <p className="mt-1 px-1 text-xs text-muted-foreground">
                    added by {item.addedByLogin}
                    {item.note ? ` — ${item.note}` : ""}
                  </p>
                </div>
                {canRemove && (
                  <form action={removeListItem}>
                    <input type="hidden" name="itemId" value={item.itemId} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${item.repo.fullName} from this list`}
                      title="Remove from list"
                    >
                      <X className="size-4" />
                    </Button>
                  </form>
                )}
              </div>
            );
          })
        )}
      </div>

      {isOwner && (
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            List settings
          </summary>
          <form action={updateList} className="mt-4 space-y-4">
            <input type="hidden" name="listId" value={list.id} />
            <div className="space-y-2">
              <Label htmlFor="title">Name</Label>
              <Input
                id="title"
                name="title"
                defaultValue={list.title}
                maxLength={TITLE_MAX}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                maxLength={DESCRIPTION_MAX}
                defaultValue={list.description ?? ""}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="contributions"
                value="closed"
                defaultChecked={list.contributions === "closed"}
                className="size-4"
              />
              Closed — only I can add repos
            </label>
            <Button type="submit" size="sm">
              Save
            </Button>
          </form>

          <details className="mt-4 border-t pt-3">
            <summary className="cursor-pointer text-sm text-destructive">
              Delete this list
            </summary>
            <form action={deleteList} className="mt-2 space-y-2">
              <input type="hidden" name="listId" value={list.id} />
              <p className="text-xs text-muted-foreground">
                The list and everything in it disappears for everyone holding the
                link. The repos themselves stay listed.
              </p>
              <Button type="submit" variant="destructive" size="sm">
                Yes, delete permanently
              </Button>
            </form>
          </details>
        </details>
      )}

      <Link
        href={isOwner ? "/lists" : "/"}
        className="inline-block text-sm text-muted-foreground hover:underline"
      >
        ← {isOwner ? "All my lists" : "Back to feed"}
      </Link>
    </div>
  );
}
