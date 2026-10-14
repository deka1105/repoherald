import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Next 16 renamed the `middleware` convention to `proxy`; this file is the
 * same thing under its new name, and it defaults to the Node.js runtime.
 *
 * clerkMiddleware() only reads the session and attaches it to the request — it
 * does NOT protect routes by itself, which is deliberate here. Authorisation in
 * this app is per-page and per-action (`requireUser`, `requireAdmin`,
 * `requireModerator`, and the `notFound()` in the admin layout), and it needs
 * the database to know a role. Duplicating that as a path matcher would create
 * a second, weaker copy of the rules that drifts from the real one.
 */
const handler = clerkMiddleware();

export default handler;
export const proxy = handler;

export const config = {
  matcher: [
    // Everything except Next internals and static files, plus always run on
    // API routes so they can read the session too.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
