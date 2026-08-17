import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { repoListItems, repoLists, users } from "@/db/schema";
import { setListStatus } from "@/app/actions/lists";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Lists are public pages carrying user-written titles and descriptions, so
// moderators need a way to pull one down without touching the owner's account.
export default async function AdminListsPage() {
  const rows = await db
    .select({
      list: repoLists,
      ownerLogin: users.githubLogin,
      itemCount: sql<number>`(
        SELECT count(*)::int FROM ${repoListItems}
        WHERE ${repoListItems.listId} = ${repoLists.id}
      )`,
    })
    .from(repoLists)
    .innerJoin(users, eq(repoLists.ownerUserId, users.id))
    .orderBy(desc(repoLists.createdAt))
    .limit(200);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>List</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Repos</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ list, ownerLogin, itemCount }) => (
          <TableRow key={list.id}>
            <TableCell>
              <Link href={`/lists/${list.slug}`} className="hover:underline">
                {list.title}
              </Link>
            </TableCell>
            <TableCell>{ownerLogin}</TableCell>
            <TableCell>{itemCount}</TableCell>
            <TableCell>
              <Badge variant={list.status === "active" ? "default" : "outline"}>
                {list.status}
              </Badge>
            </TableCell>
            <TableCell>
              <form
                action={async () => {
                  "use server";
                  await setListStatus(
                    list.id,
                    list.status === "active" ? "removed" : "active"
                  );
                }}
              >
                <Button
                  type="submit"
                  size="sm"
                  variant={list.status === "active" ? "destructive" : "outline"}
                >
                  {list.status === "active" ? "Remove" : "Restore"}
                </Button>
              </form>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
