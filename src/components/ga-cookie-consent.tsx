"use client";

import { useSyncExternalStore } from "react";
import {
  analyticsOptedOut,
  gaCookiesAllowed,
  setGaCookiesAllowed,
  subscribeConsent,
} from "@/lib/analytics-consent";

/**
 * The opt-**in** for Google Analytics cookies, shown on /cookies beside the
 * opt-out for our own counting. Two controls because they are two different
 * things: ours is cookieless and lawful without asking, Google's is not.
 *
 * Unchecked by default and never pre-ticked — a pre-ticked box is not consent.
 * It is also not a blocking modal, which is the point: nothing is set until
 * this is ticked, so there is nothing to interrupt anyone for.
 *
 * Disabled while the visitor is opted out of counting entirely, because
 * granting cookie storage to a tag that is not running would be meaningless.
 */
export function GaCookieConsent() {
  // Mirrors AnalyticsOptOut: the server snapshot must not touch localStorage,
  // and false is the safe render — unticked, nothing granted.
  const allowed = useSyncExternalStore(
    subscribeConsent,
    () => gaCookiesAllowed(),
    () => false
  );
  const optedOut = useSyncExternalStore(
    subscribeConsent,
    () => analyticsOptedOut(),
    () => false
  );

  return (
    <div className="my-4 rounded-lg border p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 cursor-pointer"
          checked={allowed}
          disabled={optedOut}
          onChange={(e) => setGaCookiesAllowed(e.target.checked)}
        />
        <span>
          <span className="font-medium">Allow Google Analytics cookies</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {optedOut
              ? "You are opted out of view counting, so Google Analytics is not running at all. Nothing to allow."
              : allowed
                ? "Allowed. Google Analytics may set its two cookies in this browser. Untick to withdraw — the cookies stop being set immediately."
                : "Off. Google Analytics runs without cookies and sends Google only aggregated, cookieless measurements. Ticking this lets it set two cookies so repeat visits can be recognised."}
          </span>
        </span>
      </label>
    </div>
  );
}
