import Link from "next/link";
import { addRepoToListById } from "@/app/actions/lists";
import { Button } from "@/components/ui/button";
import { getListsMissingRepo } from "@/lib/lists";

/** "Add to list" on a repo page — offers the viewer's own lists that don't
 * already contain this repo. Contributing to someone else's list happens
 * through their share link. */
export async function AddToList({
  repoId,
  userId,
}: {
  repoId: string;
  userId: string;
}) {
  const lists = await getListsMissingRepo(userId, repoId);

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">Add to a list</summary>
      {lists.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Every list you own already has this repo, or you have none yet —{" "}
          <Link href="/lists" className="underline underline-offset-2">
            create a list
          </Link>
          .
        </p>
      ) : (
        <form action={addRepoToListById} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="repoId" value={repoId} />
          <select
            name="listId"
            aria-label="List"
            className="h-9 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      )}
    </details>
  );
}
