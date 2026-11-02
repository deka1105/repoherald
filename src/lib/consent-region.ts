/**
 * Where prior consent is legally required before an analytics cookie may be set.
 *
 * Deliberately NOT marked `server-only`: the decision is made on the server from
 * the edge's country header, but the client component that queues the consent
 * default needs the same rule, and the test suite needs it with no DOM at all.
 *
 * The trigger is the ePrivacy Directive's consent requirement for non-essential
 * storage, which applies across the EEA, plus the UK's PECR after Brexit, plus
 * the Crown Dependencies, which run their own PECR-equivalents rather than
 * inheriting the UK's. Outside that set, analytics storage is lawful on an
 * opt-**out** basis, which is why the default flips rather than the control
 * disappearing — everyone keeps the switch on /cookies either way.
 *
 * Switzerland is deliberately absent. The revised FADP requires transparency
 * and a genuine objection route, both of which /cookies provides, but it does
 * not impose ePrivacy's prior-consent rule. It is excluded on purpose, not
 * forgotten — do not add it without a reason recorded here.
 *
 * An unresolved country counts as requiring consent. That is the whole safety
 * property of this module: a visitor we cannot place is treated as if they were
 * in Berlin, so a geo lookup that fails, is stripped by a proxy, or is spoofed
 * can only ever cost us measurement, never set a cookie that needed asking.
 */

/** EU 27. */
const EU = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
  "NL", "PL", "PT", "RO", "SE", "SI", "SK",
] as const;

/** The three non-EU EEA states — ePrivacy applies through the EEA Agreement. */
const EEA_NON_EU = ["IS", "LI", "NO"] as const;

/** The UK (PECR) and the Crown Dependencies, which legislate separately. */
const UK_AND_DEPENDENCIES = ["GB", "GG", "IM", "JE"] as const;

export const PRIOR_CONSENT_COUNTRIES: readonly string[] = [
  ...EU,
  ...EEA_NON_EU,
  ...UK_AND_DEPENDENCIES,
];

const PRIOR_CONSENT_SET = new Set<string>(PRIOR_CONSENT_COUNTRIES);

/**
 * Codes that are shaped like a country but mean "we could not place this
 * visitor": ISO 3166-1's user-assigned range (AA, QM–QZ, XA–XZ, ZZ) plus T1,
 * which some lookups return for Tor exits. The edge uses ZZ today.
 *
 * These must not fall through to "not in the consent zone, so granted" — that
 * reads an absence of information as permission. `requestCountry` already maps
 * ZZ to null upstream, so this is defence in depth for the next caller that
 * does not.
 */
const UNRESOLVED_CODE = /^(?:ZZ|AA|T1|Q[M-Z]|X[A-Z])$/;

/**
 * True when this visitor's country requires consent *before* analytics storage.
 *
 * Fails closed: null, undefined, empty, malformed and unknown all return true.
 * Only a recognised country outside the consent zone returns false.
 */
export function priorConsentRequired(
  country: string | null | undefined
): boolean {
  if (!country || !/^[A-Za-z]{2}$/.test(country)) return true;
  const code = country.toUpperCase();
  if (UNRESOLVED_CODE.test(code)) return true;
  return PRIOR_CONSENT_SET.has(code);
}
