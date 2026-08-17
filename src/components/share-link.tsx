"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Copy-the-share-link control. The origin is read from the browser so the
 * link is always for the host the visitor is actually on (localhost, preview,
 * prod); the server renders the path alone, and the ref fills in the rest
 * after mount so there is nothing to hydrate-mismatch. */
export function ShareLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        defaultValue={path}
        ref={(el) => {
          if (el) el.value = `${window.location.origin}${path}`;
        }}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Share link"
        className="min-w-0 flex-1 rounded-md border bg-muted/40 px-2 py-1 text-xs text-muted-foreground"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(`${window.location.origin}${path}`);
            setCopied(true);
          } catch {
            // Clipboard blocked (insecure context or denied permission) — the
            // input stays selectable, so there is nothing to recover from.
          }
        }}
      >
        {copied ? (
          <>
            <Check className="mr-1 size-3.5" /> Copied
          </>
        ) : (
          <>
            <Copy className="mr-1 size-3.5" /> Copy link
          </>
        )}
      </Button>
    </div>
  );
}
