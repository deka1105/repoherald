import "server-only";

/**
 * Single source of truth for the legal pages. Everything the policies assert
 * about the business comes from here, so there is exactly one place to correct.
 *
 * Business identity is read from env and DEFAULTS TO NOTHING ON PURPOSE. An
 * invented company name or address on a published privacy policy is worse than
 * an absent one — it is a false statement about a legal entity. When these are
 * unset the pages omit the identity block and fall back to the contact email.
 *
 * Set before launch: LEGAL_ENTITY_NAME, LEGAL_ENTITY_ADDRESS, LEGAL_JURISDICTION.
 */
export const LEGAL = {
  /** Registered name of the operating entity, e.g. "Example Labs Ltd". */
  entityName: process.env.LEGAL_ENTITY_NAME?.trim() || null,
  /** Postal address, newline-separated. */
  entityAddress: process.env.LEGAL_ENTITY_ADDRESS?.trim() || null,
  /** Governing law, e.g. "the State of Delaware, USA". */
  jurisdiction: process.env.LEGAL_JURISDICTION?.trim() || null,
  /** Where privacy/legal mail goes. Falls back to the sending address. */
  contactEmail:
    process.env.LEGAL_CONTACT_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.replace(/.*<|>.*/g, "").trim() ||
    null,
  /** Product + site identity. */
  serviceName: "repoherald",
  siteUrl:
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://repoherald.com",
  /**
   * Bump ONLY when the substance changes — the date is a promise to the reader
   * that nothing material changed since. Editing a typo is not a new version.
   */
  lastUpdated: "2026-09-18",
  /** Minimum age. GitHub itself requires 13+, and sign-in is GitHub-only. */
  minimumAge: 13,
} as const;

/** True when enough identity is configured to publish an operator block. */
export function hasBusinessIdentity(): boolean {
  return Boolean(LEGAL.entityName && LEGAL.entityAddress);
}

/** Support route — the one channel guaranteed to exist for any request. */
export const SUPPORT_PATH = "/support";
