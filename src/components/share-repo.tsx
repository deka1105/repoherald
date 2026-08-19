"use client";

import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Share a listing outward. Posting the link to X or Reddit is also how share
 * rewards are earned (submit the post URL on /wallet), so the same control
 * feeds the credit loop. */
export function ShareRepo({
  repoId,
  fullName,
  className,
}: {
  repoId: string;
  fullName: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = () => `${window.location.origin}/repos/${repoId}`;
  const text = `${fullName} on repoherald`;

  const openIntent = (href: string) => {
    // noopener/noreferrer: the share site must not get a handle on this tab.
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Share ${fullName}`}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted hover:text-foreground",
          className
        )}
      >
        {copied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
        {copied ? "Copied" : "Share"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        <DropdownMenuItem
          onSelect={() =>
            openIntent(
              `https://x.com/intent/tweet?text=${encodeURIComponent(
                text
              )}&url=${encodeURIComponent(url())}`
            )
          }
        >
          Share on X
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            openIntent(
              `https://reddit.com/submit?title=${encodeURIComponent(
                text
              )}&url=${encodeURIComponent(url())}`
            )
          }
        >
          Share on Reddit
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            try {
              await navigator.clipboard.writeText(url());
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard blocked — the other two options still work.
            }
          }}
        >
          <Link2 className="size-3.5" /> Copy link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
