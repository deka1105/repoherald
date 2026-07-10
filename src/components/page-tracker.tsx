"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/track-client";

/** Records a page_view on every route change (repo-detail views are reclassified
 * to repo_view server-side). Rendered once in the root layout. */
export function PageTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    trackEvent("page_view", {
      path: pathname,
      referrer: document.referrer || undefined,
    });
  }, [pathname]);

  return null;
}
