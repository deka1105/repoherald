"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/track-client";

const REPO_PATH_RE = /^\/repos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Records a github_click whenever a visitor follows an outbound github.com link
 * (chiefly "View on GitHub" on a repo page). A document-level listener avoids
 * instrumenting the root-owned repo detail page; the repo id is recovered from
 * the current /repos/{uuid} path so clicks are attributed to the right listing.
 */
export function GithubClickTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!/^https?:\/\/github\.com\//i.test(href)) return;
      const m = REPO_PATH_RE.exec(window.location.pathname);
      trackEvent("github_click", {
        path: window.location.pathname,
        repoId: m ? m[1] : undefined,
      });
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
