"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleLike } from "@/app/actions/social";
import { cn } from "@/lib/utils";

/** Like toggle. The optimistic value is derived from the server-rendered
 * props, so once the action's revalidation lands React drops back to the truth
 * rather than to a stale local copy. */
export function LikeButton({
  repoId,
  liked,
  count,
  signedIn,
  className,
}: {
  repoId: string;
  liked: boolean;
  count: number;
  signedIn: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, flip] = useOptimistic(
    { liked, count },
    (state) => ({
      liked: !state.liked,
      count: state.count + (state.liked ? -1 : 1),
    })
  );

  if (!signedIn) {
    return (
      <span
        className={cn("inline-flex items-center gap-1 text-muted-foreground", className)}
        title="Sign in to like"
      >
        <Heart className="size-3.5" /> {count.toLocaleString()}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={optimistic.liked}
      aria-label={optimistic.liked ? "Unlike this repo" : "Like this repo"}
      onClick={() =>
        startTransition(async () => {
          flip(null);
          await toggleLike(repoId);
        })
      }
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted disabled:opacity-60",
        optimistic.liked ? "text-rose-600" : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      <Heart
        className={cn("size-3.5", optimistic.liked && "fill-current")}
        aria-hidden
      />
      {optimistic.count.toLocaleString()}
    </button>
  );
}
