import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { displayNameSql } from "@/lib/display-name";
import { repoComments, repos, users } from "@/db/schema";
import { removeComment, restoreComment } from "@/app/actions/social";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

// Comments are public user-authored text, so moderators need a queue that
// isn't "go find the repo page it was posted on".
export default async function AdminCommentsPage() {
  const rows = await db
    .select({
      comment: repoComments,
      authorLogin: displayNameSql(),
      repoName: repos.fullName,
    })
    .from(repoComments)
    .innerJoin(users, eq(repoComments.userId, users.id))
    .innerJoin(repos, eq(repoComments.repoId, repos.id))
    .orderBy(desc(repoComments.createdAt))
    .limit(200);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No comments yet.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map(({ comment, authorLogin, repoName }) => (
        <div
          key={comment.id}
          className="flex items-start justify-between gap-3 rounded-md border p-3"
        >
          <div className="min-w-0">
            <p className="text-sm">
              <span className="font-medium">@{authorLogin}</span>{" "}
              <span className="text-muted-foreground">on</span>{" "}
              <Link href={`/repos/${comment.repoId}`} className="hover:underline">
                {repoName}
              </Link>{" "}
              <span className="text-xs text-muted-foreground">
                {timeAgo(comment.createdAt)}
              </span>
              {comment.status === "removed" && (
                <Badge variant="outline" className="ml-2 font-normal">
                  removed
                </Badge>
              )}
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap break-words text-muted-foreground">
              {comment.body}
            </p>
          </div>
          {comment.status === "visible" ? (
            <form action={removeComment} className="shrink-0">
              <input type="hidden" name="commentId" value={comment.id} />
              <Button type="submit" variant="destructive" size="sm">
                Remove
              </Button>
            </form>
          ) : (
            <form
              action={async () => {
                "use server";
                await restoreComment(comment.id);
              }}
              className="shrink-0"
            >
              <Button type="submit" variant="outline" size="sm">
                Restore
              </Button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
