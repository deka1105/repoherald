// Client-side analytics opt-out. Deliberately NOT a consent gate: view counting
// is cookieless and non-identifying, so it needs no permission prompt. This is
// a genuine switch for people who would rather not be counted at all.

export const OPT_OUT_KEY = "rh_analytics_opt_out";
export const NOTICE_KEY = "rh_storage_notice_seen";
export const CONSENT_EVENT = "rh-consent-change";

/**
 * The visitor's choice about Google Analytics cookies. Separate from
 * OPT_OUT_KEY, and tri-state rather than boolean, deliberately.
 *
 * Our own counting is cookieless and stores no IP, so it is lawful without
 * permission and the switch above is a courtesy — opt **out**. Google
 * Analytics' `_ga` cookies are different: not consent-exempt under ePrivacy,
 * so inside the EEA, UK and Crown Dependencies they need permission *first*.
 * Elsewhere opt-out is the lawful standard, so the same control is presented
 * as a switch that starts on.
 *
 * Which of those applies is decided on the server from the edge's country
 * header and handed in as `priorConsentRequired`; this key only ever stores
 * what the visitor themselves chose, never where they are. See gaChoice and
 * gaStorageGranted below, and src/lib/consent-region.ts for the rule.
 *
 * Without a grant Google Analytics still runs, under Consent Mode with
 * `analytics_storage: "denied"`: no cookie is written and Google receives
 * cookieless pings. Those pings do not appear as users or sessions in GA4's
 * standard reports — they only feed behavioural modelling, which is gated
 * behind traffic thresholds this site does not meet. Denied is therefore
 * genuinely "no measurement", not "slightly worse measurement".
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
 * The visitor's own explicit choice about analytics cookies, or null if they
 * have never made one.
 *
 * Three states, not two, and that is the point. "Never asked" must resolve
 * differently depending on where the visitor is, so it cannot be collapsed
 * into "no" at this level — see gaStorageGranted below. An explicit refusal
 * is stored as "0" rather than by deleting the key, so that refusing outside
 * the consent zone is durable instead of decaying back into the default.
 *
 * Everything uncertain reads as an explicit refusal: a server render and
 * unreadable storage both return false, never null. A cookie that might have
 * needed permission must never be set because a preference could not be read.
 */
export function gaChoice(): boolean | null {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(GA_CONSENT_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  } catch {
    return false;
  }
}

/**
 * Whether Google Analytics may use storage for this visitor, right now.
 *
 * The single source of truth for the consent signal, resolved in precedence
 * order: a full opt-out or Global Privacy Control beats everything, then the
 * visitor's own explicit choice, then the regional default.
 *
 * `priorConsentRequired` comes from the server, from the edge's country
 * header — never from anything the browser could assert about itself. Inside
 * the EEA, UK and Crown Dependencies an untouched switch means denied; outside
 * it means granted, which is lawful there on an opt-out basis. A country we
 * could not resolve counts as requiring consent, so the failure mode is lost
 * measurement rather than an unlawful cookie.
 */
export function gaStorageGranted(priorConsentRequired: boolean): boolean {
  if (typeof window === "undefined") return false;
  if (analyticsOptedOut()) return false;
  const choice = gaChoice();
  if (choice !== null) return choice;
  return !priorConsentRequired;
}

/**
 * Record an explicit choice. Writes "0" for a refusal rather than clearing the
 * key, so that a visitor outside the consent zone who switches this off stays
 * switched off instead of reverting to the granted default on the next visit.
 */
export function setGaCookiesAllowed(allowed: boolean) {
  try {
    localStorage.setItem(GA_CONSENT_KEY, allowed ? "1" : "0");
    window.dispatchEvent(new Event(CONSENT_EVENT));
  } catch {
    // gaStorageGranted() already fails closed.
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
