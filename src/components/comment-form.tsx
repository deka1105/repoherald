"use client";

import { useActionState } from "react";
import { postComment, type CommentState } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { COMMENT_MAX } from "@/lib/social";

export function CommentForm({ repoId }: { repoId: string }) {
  const [state, action, pending] = useActionState<CommentState, FormData>(
    postComment,
    {}
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="repoId" value={repoId} />
      <Textarea
        name="body"
        rows={3}
        maxLength={COMMENT_MAX}
        required
        placeholder="Share what you think of this repo…"
        aria-label="Your comment"
      />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Posting…" : "Comment"}
        </Button>
      </div>
    </form>
  );
}
