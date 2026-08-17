import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserLists } from "@/lib/lists";
import { CreateListForm } from "./create-list-form";

export const metadata = { title: "My lists — repoherald" };

export default async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const { msg } = await searchParams;
  const lists = await getUserLists(session.user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">My lists</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Curate repos into a page you can share with a link. Anyone who opens
          it can add repos too — you can remove any of them, or close the list to
          additions, at any time.
        </p>
      </div>

      {msg && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{msg}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New list</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateListForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your lists ({lists.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {lists.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No lists yet — create one above.
            </p>
          ) : (
            lists.map(({ list, itemCount }) => (
              <div
                key={list.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/lists/${list.slug}`}
                    className="font-medium hover:underline"
                  >
                    {list.title}
                  </Link>
                  {list.description && (
                    <p className="line-clamp-1 text-sm text-muted-foreground">
                      {list.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {list.contributions === "closed" && (
                    <Badge variant="outline" className="font-normal">
                      Closed
                    </Badge>
                  )}
                  <span>
                    {itemCount} {itemCount === 1 ? "repo" : "repos"}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
