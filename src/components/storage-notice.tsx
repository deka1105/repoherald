"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  analyticsOptedOut,
  markNoticeSeen,
  noticeSeen,
  setAnalyticsOptOut,
  subscribeConsent,
} from "@/lib/analytics-consent";

/**
 * Storage notice.
 *
 * Deliberately NOT a consent wall. We set no advertising cookies and our own
 * view counting is cookieless and stores no IP, so nothing that legally
 * requires permission is set before it is given. A modal demanding consent for
 * cookies we do not set would be theatre — and the kind of manufactured
 * friction this project is trying to avoid.
 *
 * `priorConsentRequired` is why this is still true now that Google Analytics
 * storage is region-conditional. Inside the EEA, UK and Crown Dependencies it
 * stays denied until someone ticks the opt-in on /cookies, so there is nothing
 * to consent to and a notice is the correct instrument. Outside that zone
 * analytics storage is lawful on an opt-out basis, so a cookie may be set — and
 * the text below has to say so, which is the only reason this component needs
 * the flag at all.
 *
 * The rule that must not be broken: `analytics_storage` granted by default for
 * a visitor inside the consent zone would make this notice unlawful there, not
 * merely inaccurate. See src/lib/consent-region.ts, which fails closed for
 * exactly that reason.
 *
 * So: a dismissible strip that says what is stored, with a genuine opt-out
 * beside it. Both buttons carry the same visual weight — no "Accept all" in
 * colour next to a grey "Manage". Dismissing changes nothing and opts you into
 * nothing; it only stops the strip reappearing.
 */
export function StorageNotice({
  priorConsentRequired,
}: {
  priorConsentRequired: boolean;
}) {
  const seen = useSyncExternalStore(
    subscribeConsent,
    () => noticeSeen(),
    () => true // SSR: render nothing, so it can never flash before hydration
  );
  const optedOut = useSyncExternalStore(
    subscribeConsent,
    () => analyticsOptedOut(),
    () => false
  );

  if (seen) return null;

  return (
    <div
      role="region"
      aria-label="Storage and privacy notice"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/98 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/85"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 text-sm leading-6">
          We use one cookie to keep you signed in and one to remember your feed layout. View counts
          are cookieless and store no IP address.{" "}
          {!priorConsentRequired && (
            <>
              Google Analytics may also set two cookies to recognise repeat visits; you can switch
              that off.{" "}
            </>
          )}
          <Link href="/cookies" className="underline underline-offset-4">
            Details
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          {/* Same size, same variant, same prominence — neither is the "safe"
              choice being nudged. */}
          {!optedOut && (
            <button
              type="button"
              onClick={() => {
                setAnalyticsOptOut(true);
                markNoticeSeen();
              }}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Don’t count my views
            </button>
          )}
          <button
            type="button"
            onClick={markNoticeSeen}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
