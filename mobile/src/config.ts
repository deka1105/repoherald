/**
 * The one file that differs between a local build and a shipped one.
 *
 * GITHUB_CLIENT_ID is a *public* value — OAuth client ids are not secrets, and
 * the client secret deliberately never reaches the device. The app uses PKCE,
 * which exists precisely so a public client can do OAuth without one.
 */
export const API_BASE = "https://repoherald.vercel.app";
export const GITHUB_CLIENT_ID = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? "";

/** Scopes must match the web app's — read:user user:email, nothing more. */
export const GITHUB_SCOPES = ["read:user", "user:email"];
