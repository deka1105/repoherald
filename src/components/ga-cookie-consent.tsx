"use client";

import { useSyncExternalStore } from "react";
import {
  analyticsOptedOut,
  gaStorageGranted,
  setGaCookiesAllowed,
  subscribeConsent,
} from "@/lib/analytics-consent";

/**
 * The control for Google Analytics cookies, shown on /cookies beside the
 * opt-out for our own counting. Two controls because they are two different
 * things: ours is cookieless and lawful without asking, Google's is not.
 *
 * Its polarity follows the law where the visitor is, which is why
 * `priorConsentRequired` is passed in from the server rather than guessed
 * here. Inside the EEA, UK and Crown Dependencies it starts unticked and is a
 * genuine opt-**in** — never pre-ticked, because a pre-ticked box is not
 * consent, and nothing is set until it is ticked, so there is nothing to
 * interrupt anyone with. Elsewhere analytics storage is lawful on an opt-out
 * basis, so it starts ticked and unticking is a withdrawal that sticks.
 *
 * Either way the visible state is the *effective* state, so the box always
 * tells the truth about what the tag is doing right now.
 *
 * Disabled while the visitor is opted out of counting entirely, because
 * granting cookie storage to a tag that is not running would be meaningless.
 */
export function GaCookieConsent({
  priorConsentRequired,
}: {
  priorConsentRequired: boolean;
}) {
  // Mirrors AnalyticsOptOut: the server snapshot must not touch localStorage.
  // False is the safe render in both regions — an unticked box that corrects
  // itself on hydration cannot have set a cookie; the reverse could.
  const granted = useSyncExternalStore(
    subscribeConsent,
    () => gaStorageGranted(priorConsentRequired),
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
          checked={granted}
          disabled={optedOut}
          onChange={(e) => setGaCookiesAllowed(e.target.checked)}
        />
        <span>
          <span className="font-medium">Allow Google Analytics cookies</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {optedOut
              ? "You are opted out of view counting, so Google Analytics is not running at all. Nothing to allow."
              : granted
                ? "Allowed. Google Analytics may set its two cookies in this browser. Untick to withdraw — the cookies stop being set immediately, and the choice is remembered."
                : "Off. Google Analytics runs without cookies, and Google receives only cookieless pings it does not report on. Ticking this lets it set two cookies so repeat visits can be recognised."}
          </span>
        </span>
      </label>
    </div>
  );
}
