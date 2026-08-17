"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Copy-the-share-link control. The URL is read from the browser so it is
 * always the origin the visitor is actually on (localhost, preview, prod). */
export function ShareLink({ path }: { path: string }) {
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
  }, [path]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-md border bg-muted/40 px-2 py-1 text-xs text-muted-foreground"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            // Clipboard blocked (insecure context or denied permission) — the
            // input above is still selectable, so there's nothing to recover.
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
