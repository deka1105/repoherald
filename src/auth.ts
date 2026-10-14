import "server-only";
import { cache } from "react";
import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { resolveClerkUser } from "@/lib/clerk-user";

export type UserRole = "user" | "moderator" | "admin";

/**
 * The session shape the rest of the app reads.
 *
 * Deliberately identical to what Auth.js used to return, so that the ~28 files
 * calling `auth()` did not have to change when identity moved to Clerk. Clerk
 * owns who you are; this object is still assembled from the `users` row,
 * because role, credits and everything else the product gates on live there and
 * never lived in the token.
 */
export type Session = {
  user: {
    id: string;
    role: UserRole;
    /** @deprecated use role — kept for root-owned (app) route files. */
    isAdmin: boolean;
    /** NULL when the account has not connected GitHub. */
    githubLogin: string | null;
    image?: string | null;
  };
} | null;

/**
 * Cached per request: `auth()` is called repeatedly across a single render
 * (layout, page, and several components), and without this each call would be
 * a fresh database lookup. React's cache() scopes the memo to one request, so
 * two concurrent visitors never share a session.
 */
export const auth = cache(async (): Promise<Session> => {
  const { userId } = await clerkAuth();
  if (!userId) return null;

  // Resolves the local row, creating or linking it on first sign-in. Doing it
  // here rather than in a webhook means there is no window where somebody is
  // signed in to Clerk but unknown to the app.
  const row = await resolveClerkUser(userId);
  if (!row) return null;

  return {
    user: {
      id: row.id,
      role: row.role,
      isAdmin: row.role === "admin",
      githubLogin: row.githubLogin,
    },
  };
});

/** Avatar, which only the chrome needs — kept off `auth()` so the common path
 *  stays a single query. */
export async function sessionImage(): Promise<string | null> {
  const u = await currentUser();
  return u?.imageUrl ?? null;
}
