import { analyticsOptedOut } from "@/lib/analytics-consent";

// Fire-and-forget client-side event beacon. Uses sendBeacon so it survives
// navigations/unloads; falls back to keepalive fetch. Never throws.
export function trackEvent(
  type: "page_view" | "claim_click" | "donate_click" | "github_click",
  data?: { path?: string; repoId?: string; referrer?: string }
) {
  // Checked at send time, not at import time, so toggling the switch takes
  // effect on the very next event without a reload.
  if (analyticsOptedOut()) return;
  try {
    const payload = JSON.stringify({ type, ...data });
    const blob = new Blob([payload], { type: "application/json" });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", blob);
    } else {
      void fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  } catch {
    // analytics must never break the app
  }
}
