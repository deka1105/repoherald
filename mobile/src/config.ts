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
/**
 * The canonical production origin.
 *
 * NOT the *.vercel.app hostname: that answers every request with a 308 to
 * repoherald.com, so each API call would cost an extra round trip and would
 * depend on the client re-sending the Authorization header across an
 * origin change — which is exactly the kind of thing a fetch implementation
 * is entitled not to do.
 */
export const API_BASE = "https://repoherald.com";

export const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

// ClerkProvider throws on an empty key anyway; this only makes the cause
// legible. A build that reaches here is one where the EAS environment named by
// the build profile has no EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY — see .env.example.
if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error(
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is unset. This build cannot sign anyone " +
      "in. Set it in the EAS environment for this build profile (see " +
      "mobile/.env.example) and rebuild."
  );
}

/** The deep link Clerk returns to after a browser-based SSO flow. Must match
 *  the entry allowlisted under Native applications in the Clerk dashboard. */
export const SSO_REDIRECT_PATH = "sso-callback";

/** Policy pages, opened in the system browser from the account screen. */
export const PRIVACY_URL = `${API_BASE}/privacy`;
export const TERMS_URL = `${API_BASE}/terms`;
export const SUPPORT_URL = `${API_BASE}/support`;
