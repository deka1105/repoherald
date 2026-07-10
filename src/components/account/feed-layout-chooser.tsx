"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import {
  FEED_LAYOUTS,
  FEED_LAYOUT_COOKIE,
  type FeedLayout,
} from "@/lib/feed-layout";

function persistLayout(id: FeedLayout) {
  document.cookie = `${FEED_LAYOUT_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
}

function Bar() {
  return <div className="h-2 rounded-sm bg-muted-foreground/25" />;
}

function Tile() {
  return <div className="aspect-square rounded-sm bg-muted-foreground/25" />;
}

function Preview({ kind }: { kind: FeedLayout }) {
  if (kind === "banners") {
    return (
      <div className="space-y-1">
        <Bar />
        <Bar />
        <Bar />
      </div>
    );
  }
  if (kind === "tiles") {
    return (
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Tile key={i} />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Bar />
      <div className="grid grid-cols-3 gap-1">
        <Tile />
        <Tile />
        <Tile />
      </div>
    </div>
  );
}

export function FeedLayoutChooser({ initial }: { initial: FeedLayout }) {
  const [value, setValue] = useState<FeedLayout>(initial);
  const router = useRouter();

  const choose = (id: FeedLayout) => {
    if (id === value) return;
    setValue(id);
    document.cookie = `${FEED_LAYOUT_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    // Bust the router cache so the feed re-renders in the new layout next visit.
    router.refresh();
  };

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {FEED_LAYOUTS.map((l) => {
          const active = value === l.id;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => choose(l.id)}
              aria-pressed={active}
              className={`flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors ${
                active
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:bg-accent"
              }`}
            >
              <span className="rounded-md bg-background/60 p-2 ring-1 ring-border">
                <Preview kind={l.id} />
              </span>
              <span className="flex items-center gap-1 text-sm font-medium">
                {l.label}
                {active && <Check className="size-3.5 text-primary" aria-hidden />}
              </span>
              <span className="text-xs text-muted-foreground">
                {l.description}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Applies to your Discover feed.
      </p>
    </div>
  );
}
