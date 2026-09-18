// Client-side analytics opt-out. Deliberately NOT a consent gate: view counting
// is cookieless and non-identifying, so it needs no permission prompt. This is
// a genuine switch for people who would rather not be counted at all.

export const OPT_OUT_KEY = "rh_analytics_opt_out";
export const NOTICE_KEY = "rh_storage_notice_seen";
export const CONSENT_EVENT = "rh-consent-change";

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
