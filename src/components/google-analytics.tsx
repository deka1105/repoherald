"use client";

import { useEffect } from "react";
import {
  analyticsOptedOut,
  gaCookiesAllowed,
  subscribeConsent,
} from "@/lib/analytics-consent";

/**
 * Google Analytics 4, under Consent Mode v2 with storage denied by default.
 *
 * Dormant until NEXT_PUBLIC_GA_MEASUREMENT_ID is set, like Sentry — so local
 * development and preview builds never write into the production property.
 *
 * Why not the snippet Google hands you: `_ga` cookies are not consent-exempt
 * under ePrivacy in the EU and UK, and this site's storage notice is a notice
 * rather than a consent wall precisely because nothing it sets needs
 * permission. Dropping the stock snippet in would have made that false, and
 * made /cookies' "this is the complete list" false with it.
 *
 * So the tag loads with every storage type **denied**. Google receives
 * cookieless, aggregated pings; no cookie is written; the three-cookie claim
 * on /cookies stays true for anyone who has not asked otherwise. Granting
 * `analytics_storage` requires an explicit opt-in on /cookies, and only that
 * one key is ever granted — the advertising keys stay denied permanently, so
 * no ad identifier or personalisation signal is ever created.
 *
 * Order matters more than it looks: `consent default` must sit in the dataLayer
 * queue ahead of `config`, or the tag initialises with storage allowed and sets
 * a cookie before the denial lands. gtag.js drains the queue in order, so
 * queueing before injecting the script is what guarantees this, not DOM order.
 */

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const SCRIPT_ID = "ga-gtag";

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Queue consent + config, then inject gtag.js. Idempotent. */
function ensureLoaded(measurementId: string) {
  if (document.getElementById(SCRIPT_ID)) return;

  window.dataLayer = window.dataLayer ?? [];
  const gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };
  window.gtag = gtag;

  // Denied first, before anything can act on it.
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
  gtag("js", new Date());
  gtag("config", measurementId);

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
}

export function GoogleAnalytics() {
  useEffect(() => {
    if (!MEASUREMENT_ID) return;

    const sync = () => {
      // A full opt-out (or Global Privacy Control) means the tag is never
      // introduced. If it is already present from before the switch was
      // flipped, revoke its storage rather than leave it as it was.
      if (analyticsOptedOut()) {
        window.gtag?.("consent", "update", { analytics_storage: "denied" });
        return;
      }

      ensureLoaded(MEASUREMENT_ID);
      // Only this key is ever granted. The advertising keys are never revisited.
      window.gtag?.("consent", "update", {
        analytics_storage: gaCookiesAllowed() ? "granted" : "denied",
      });
    };

    sync();
    // Re-run on every consent change, so toggling either switch takes effect
    // without a reload — the same contract as src/lib/track-client.ts.
    return subscribeConsent(sync);
  }, []);

  return null;
}
