import { X } from "lucide-react";
import { removeComment } from "@/app/actions/social";
import { CommentForm } from "@/components/comment-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { RepoComment } from "@/lib/social";
import { formatHandle } from "@/lib/display-name";
import { timeAgo } from "@/lib/utils";

export function Comments({
  repoId,
  comments,
  viewer,
}: {
  repoId: string;
  comments: RepoComment[];
  viewer: { id: string; isStaff: boolean } | null;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">
        {comments.length} {comments.length === 1 ? "comment" : "comments"}
      </h2>

      {viewer ? (
        <CommentForm repoId={repoId} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Sign in with GitHub to join the conversation.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet — be the first.
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => {
            const canRemove =
              viewer && (viewer.isStaff || viewer.id === c.authorId);
            return (
              <li key={c.id} className="flex items-start gap-3">
                <Avatar className="mt-0.5 size-8 shrink-0">
                  <AvatarImage src={c.authorAvatarUrl ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {c.authorName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">
                      {formatHandle(c.authorLogin, c.authorName)}
                    </span>{" "}
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(c.createdAt)}
                    </span>
                  </p>
                  {/* User-authored text: rendered as plain text, never HTML. */}
                  <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">
                    {c.body}
                  </p>
                </div>
                {canRemove && (
                  <form action={removeComment}>
                    <input type="hidden" name="commentId" value={c.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove comment by ${c.authorName}`}
                      title="Remove comment"
                    >
                      <X className="size-4" />
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
