"use client";

import { useEffect } from "react";
import {
  analyticsOptedOut,
  gaStorageGranted,
  subscribeConsent,
} from "@/lib/analytics-consent";

/**
 * Google Analytics 4, under Consent Mode v2 with a region-conditional default.
 *
 * Dormant until NEXT_PUBLIC_GA_MEASUREMENT_ID is set, like Sentry — so local
 * development and preview builds never write into the production property.
 *
 * Why not the snippet Google hands you: `_ga` cookies are not consent-exempt
 * under ePrivacy, so dropping the stock snippet in would have set a cookie
 * before anyone was asked. Instead the consent signal is resolved before the
 * tag is introduced, by `gaStorageGranted`, in this precedence: a full opt-out
 * or Global Privacy Control, then the visitor's own explicit choice on
 * /cookies, then the regional default.
 *
 * `priorConsentRequired` arrives as a prop because it is decided on the
 * **server**, from the edge's country header — never from a timezone, locale
 * or anything else the browser could assert about itself, and never fetched,
 * because the signal has to be queued before the tag loads and an async
 * lookup could not be. Inside the EEA, UK and Crown Dependencies the default
 * is denied and an opt-in is required; outside, analytics storage is lawful on
 * an opt-out basis and the default is granted. An unresolved country counts as
 * requiring consent. See src/lib/consent-region.ts.
 *
 * Only `analytics_storage` is ever granted. `ad_storage`, `ad_user_data` and
 * `ad_personalization` are denied at the default and never revisited, which is
 * what keeps /privacy's "no advertising or cross-site tracking identifiers"
 * true everywhere, regardless of region.
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
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * The gtag command queue.
 *
 * It must push the `arguments` object itself, never a copied array. gtag.js
 * recognises a command only when it arrives as array-like Arguments; a real
 * Array lands in the queue and is ignored. Nothing throws, nothing warns, and
 * `config` simply never registers — so the tag transmits no hits at all, sets
 * no cookie, and applies no consent. The queue looks perfectly correct while
 * doing nothing, which is the whole trap.
 *
 * This is why Google's snippet is written `function gtag(){dataLayer.push(
 * arguments);}`. Tidying it into a rest-parameter arrow is exactly the change
 * that breaks it, and it shipped that way once already. Exported so a test can
 * assert the queued value is Arguments and not an Array — the only check that
 * would have caught it.
 */
export function createGtag(target: unknown[]): (...args: unknown[]) => void {
  function gtag() {
    // The Arguments object IS the payload gtag.js requires; rest parameters
    // would produce an Array, which it ignores. See the note above.
    // eslint-disable-next-line prefer-rest-params
    target.push(arguments);
  }
  return gtag as (...args: unknown[]) => void;
}

/**
 * Queue consent + config, then inject gtag.js. Idempotent.
 *
 * `granted` is the already-resolved signal, not the region flag: the default
 * has to be the final answer for this visitor, because anything granted here
 * and corrected a moment later by `consent update` could still have written a
 * cookie in between.
 */
function ensureLoaded(measurementId: string, granted: boolean) {
  if (document.getElementById(SCRIPT_ID)) return;

  window.dataLayer = window.dataLayer ?? [];
  const gtag = createGtag(window.dataLayer);
  window.gtag = gtag;

  // The advertising keys are denied here and never granted anywhere.
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: granted ? "granted" : "denied",
  });
  gtag("js", new Date());
  gtag("config", measurementId);

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
}

/**
 * Delete any `_ga*` cookies already in this browser.
 *
 * Consent Mode's "denied" stops gtag.js reading or refreshing storage, but it
 * does not remove what a previous "granted" wrote. Without this, someone who
 * switches the control off keeps carrying the two cookies until they expire
 * two years later — which makes /cookies' promise that unticking stops them
 * true only in the narrowest reading. Withdrawal should leave nothing behind.
 *
 * `_ga` is set on the registrable domain, so expiring it needs a matching
 * domain attribute; the exact one is not knowable from script, so every
 * suffix of the current host is tried, with and without a leading dot. A
 * mismatched attempt is a no-op, so over-trying is free.
 */
function clearGaCookies() {
  const names = document.cookie
    .split("; ")
    .map((c) => c.split("=")[0])
    .filter((n) => n === "_ga" || n.startsWith("_ga_"));
  if (names.length === 0) return;

  const parts = location.hostname.split(".");
  const domains = [undefined as string | undefined];
  for (let i = 0; i < parts.length - 1; i++) {
    const d = parts.slice(i).join(".");
    domains.push(d, `.${d}`);
  }

  for (const name of names) {
    for (const domain of domains) {
      document.cookie =
        `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` +
        (domain ? `; domain=${domain}` : "");
    }
  }
}

export function GoogleAnalytics({
  priorConsentRequired,
}: {
  priorConsentRequired: boolean;
}) {
  useEffect(() => {
    if (!MEASUREMENT_ID) return;

    const sync = () => {
      // A full opt-out (or Global Privacy Control) means the tag is never
      // introduced. If it is already present from before the switch was
      // flipped, revoke its storage rather than leave it as it was.
      if (analyticsOptedOut()) {
        window.gtag?.("consent", "update", { analytics_storage: "denied" });
        clearGaCookies();
        return;
      }

      const granted = gaStorageGranted(priorConsentRequired);
      ensureLoaded(MEASUREMENT_ID, granted);
      // Denied covers three cases that all end the same way: inside the consent
      // zone with no opt-in, an explicit refusal anywhere, or a withdrawal just
      // now. Only the last leaves cookies behind, and clearing is a no-op for
      // the others.
      if (!granted) clearGaCookies();
      // Redundant on the first run, since the default above already carries
      // this value. It is what makes a later toggle take effect, and it is
      // also the only path that can revoke storage from an already-loaded tag.
      window.gtag?.("consent", "update", {
        analytics_storage: granted ? "granted" : "denied",
      });
    };

    sync();
    // Re-run on every consent change, so toggling either switch takes effect
    // without a reload — the same contract as src/lib/track-client.ts.
    return subscribeConsent(sync);
  }, [priorConsentRequired]);

  return null;
}
