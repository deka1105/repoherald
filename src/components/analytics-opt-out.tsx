"use client";

import { useSyncExternalStore } from "react";
import {
  analyticsOptedOut,
  optedOutByGpc,
  setAnalyticsOptOut,
  subscribeConsent,
} from "@/lib/analytics-consent";

/**
 * The real switch, shown on /cookies. A checkbox rather than a styled toggle:
 * it is keyboard-operable and screen-reader-labelled for free, and its state is
 * announced without any ARIA of our own.
 */
export function AnalyticsOptOut() {
  // SSR renders the opted-IN state; the effect-free store sync corrects it on
  // hydration. getServerSnapshot must not touch localStorage.
  const optedOut = useSyncExternalStore(
    subscribeConsent,
    () => analyticsOptedOut(),
    () => false
  );
  const byGpc = useSyncExternalStore(
    subscribeConsent,
    () => optedOutByGpc(),
    () => false
  );

  return (
    <div className="my-4 rounded-lg border p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 cursor-pointer"
          checked={optedOut}
          disabled={byGpc}
          onChange={(e) => setAnalyticsOptOut(e.target.checked)}
        />
        <span>
          <span className="font-medium">Don’t count my views</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {byGpc
              ? "Your browser sends a Global Privacy Control signal, so you are already opted out. We honour it automatically and this cannot be switched back on here."
              : optedOut
                ? "You are opted out. This browser sends no view events."
                : "View counting is on. It uses no cookies and stores no IP address."}
          </span>
        </span>
      </label>
    </div>
  );
}
