// Client-side analytics opt-out. Deliberately NOT a consent gate: view counting
// is cookieless and non-identifying, so it needs no permission prompt. This is
// a genuine switch for people who would rather not be counted at all.

export const OPT_OUT_KEY = "rh_analytics_opt_out";
export const NOTICE_KEY = "rh_storage_notice_seen";
export const CONSENT_EVENT = "rh-consent-change";

/**
 * Permission for Google Analytics to store its cookies. Separate from
 * OPT_OUT_KEY, and the opposite polarity, deliberately.
 *
 * Our own counting is cookieless and stores no IP, so it is lawful without
 * permission and the switch above is a courtesy — opt **out**. Google
 * Analytics' `_ga` cookies are not consent-exempt under ePrivacy in the EU and
 * UK, so they need permission *first* — opt **in**, default off, and absent
 * storage means off rather than on.
 *
 * Without this grant Google Analytics still runs, under Consent Mode with
 * `analytics_storage: "denied"`: no cookie is written and Google receives
 * cookieless, aggregated pings. Granting trades that for full measurement.
 */
export const GA_CONSENT_KEY = "rh_ga_cookies";

/**
 * Global Privacy Control is a legally recognised opt-out signal in several
 * jurisdictions. Honouring it automatically means a visitor who has set it
 * never has to find our switch.
 */
function gpcEnabled(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl === true
  );
}

/** True when this browser should not send analytics events. */
export function analyticsOptedOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (gpcEnabled()) return true;
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    // Storage blocked (private mode, hardened settings). Treat an unreadable
    // preference as opted OUT: counting someone who may have refused is the
    // worse error.
    return true;
  }
}

/** True when the browser is opted out by GPC rather than by our switch. */
export function optedOutByGpc(): boolean {
  return typeof window !== "undefined" && gpcEnabled();
}

export function setAnalyticsOptOut(optOut: boolean) {
  try {
    if (optOut) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
    window.dispatchEvent(new Event(CONSENT_EVENT));
  } catch {
    // Nothing to do — analyticsOptedOut() already fails closed.
  }
}

/**
 * True only when the visitor has actively allowed analytics cookies.
 *
 * Fails closed in every uncertain case: no stored value, unreadable storage,
 * server render, an active opt-out, or a Global Privacy Control signal all
 * mean *not granted*. A cookie that needs prior permission must never be set
 * because a preference could not be read.
 */
export function gaCookiesAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (analyticsOptedOut()) return false;
  try {
    return localStorage.getItem(GA_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setGaCookiesAllowed(allowed: boolean) {
  try {
    if (allowed) localStorage.setItem(GA_CONSENT_KEY, "1");
    else localStorage.removeItem(GA_CONSENT_KEY);
    window.dispatchEvent(new Event(CONSENT_EVENT));
  } catch {
    // gaCookiesAllowed() already fails closed.
  }
}

export function noticeSeen(): boolean {
  if (typeof window === "undefined") return true; // never flash during SSR
  try {
    return localStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markNoticeSeen() {
  try {
    localStorage.setItem(NOTICE_KEY, "1");
    window.dispatchEvent(new Event(CONSENT_EVENT));
  } catch {
    /* ignore */
  }
}

export function subscribeConsent(cb: () => void) {
  window.addEventListener(CONSENT_EVENT, cb);
  return () => window.removeEventListener(CONSENT_EVENT, cb);
}
