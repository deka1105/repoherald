"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { setRepoListed } from "@/app/actions/account-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type MyPost = {
  id: string;
  fullName: string;
  status: string;
  starsCount: number;
};

export function MyPosts({ posts }: { posts: MyPost[] }) {
  const [items, setItems] = useState(posts);
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You haven&apos;t posted any repos yet.{" "}
        <Link href="/post" className="underline">
          Post one
        </Link>
        .
      </p>
    );
  }

  const toggle = (id: string, listed: boolean) => {
    startTransition(async () => {
      try {
        await setRepoListed(id, listed);
        setItems((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, status: listed ? "active" : "hidden" } : p
          )
        );
        toast.success(listed ? "Listing is live again." : "Listing unlisted.");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't update that listing."
        );
      }
    });
  };

  return (
    <ul className="divide-y">
      {items.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <Link
              href={`/repos/${p.id}`}
              className="block truncate font-medium hover:underline"
            >
              {p.fullName}
            </Link>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>★ {p.starsCount}</span>
              {p.status === "active" && <Badge variant="secondary">Listed</Badge>}
              {p.status === "hidden" && <Badge variant="outline">Unlisted</Badge>}
              {p.status === "removed" && (
                <Badge variant="destructive">Removed</Badge>
              )}
            </div>
          </div>
          {p.status === "removed" ? (
            <span className="text-xs text-muted-foreground">By moderation</span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => toggle(p.id, p.status !== "active")}
            >
              {p.status === "active" ? "Unlist" : "Relist"}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
