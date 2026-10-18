/**
 * The one file that differs between a local build and a shipped one.
 *
 * CLERK_PUBLISHABLE_KEY is a *public* value, as the name says — it identifies
 * the Clerk instance to its own frontend API and is safe in a binary anyone can
 * unzip. The secret key stays on the server and never reaches the device.
 *
 * It must be present at *build* time: EXPO_PUBLIC_* variables are inlined into
 * the bundle, so an unset key produces a shipped app that cannot sign anyone in
 * rather than one that reads the value later. See `env` in eas.json.
 */
export const API_BASE = "https://repoherald.vercel.app";

export const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

/** The deep link Clerk returns to after a browser-based SSO flow. Must match
 *  the entry allowlisted under Native applications in the Clerk dashboard. */
export const SSO_REDIRECT_PATH = "sso-callback";

/** Policy pages, opened in the system browser from the account screen. */
export const PRIVACY_URL = `${API_BASE}/privacy`;
export const TERMS_URL = `${API_BASE}/terms`;
export const SUPPORT_URL = `${API_BASE}/support`;
