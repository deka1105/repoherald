import type { BrowserOptions, Event } from "@sentry/nextjs";

/**
 * Derived from the SDK's own option signature rather than imported by name:
 * @sentry/nextjs re-exports `Event` but not `SpanJSON`, and @sentry/core is a
 * transitive package we do not declare. Reading the type off the option we are
 * satisfying also means a signature change shows up here as a type error.
 */
type SentrySpan = Parameters<NonNullable<BrowserOptions["beforeSendSpan"]>>[0];

/**
 * Sentry privacy guard: strip the carriers of IP and location before an event
 * leaves the process.
 *
 * /privacy promises "No location beyond what a hostname or hashed visitor
 * number implies", and src/lib/analytics.ts keeps that true of our own
 * counting — the IP is only ever hash input, never a column. Sentry is the
 * other way that claim could quietly become false, and on Vercel it would not
 * even need GeoIP to do it: every request arrives stamped with
 * x-vercel-ip-country / -country-region / -city / -latitude / -longitude /
 * -timezone, and the server SDK attaches incoming request headers to error
 * events and span attributes. That is a visitor's city and coordinates as
 * plain header values, not an inference.
 *
 * `sendDefaultPii: false` already filters those today — @sentry/core's deny
 * list includes the snippet "-ip", matched as a substring, and every Vercel
 * geo header carries the "-ip-" infix. Two reasons not to rely on that alone:
 *
 *  1. `sendDefaultPii` is deprecated. From SDK v11 the `dataCollection`
 *     defaults always apply, and its `userInfo` default is `true` — the IP is
 *     sent. A routine major upgrade would switch location collection on with
 *     no change to our code, no warning, and no reviewer looking at /privacy.
 *  2. That deny list is substring matching, not an allowlist. It catches the
 *     current Vercel header names by coincidence of their shape. A renamed or
 *     hand-added geo header (x-geo-country) would pass straight through.
 *
 * So we drop the carriers outright rather than trust them to be filtered. The
 * cost is low: a stack trace is still a stack trace without request headers,
 * and the browser/OS context Sentry derives from the user-agent is a separate
 * field that survives this.
 */

/** Span attribute prefixes holding raw header values. */
const HEADER_ATTR_PREFIXES = [
  "http.request.header.",
  "http.response.header.",
];

/**
 * Scrub an error or transaction event.
 *
 * `ip_address` is set to null rather than deleted, deliberately: null is what
 * tells Sentry's ingest *not* to infer the address from the connection the
 * event arrived on. An absent field is the case a future default would be
 * free to fill in, which is the whole thing we are guarding against.
 */
export function scrubSentryEvent<T extends Event>(event: T): T {
  if (event.request) {
    delete event.request.headers;
    delete event.request.cookies;
  }

  const user = { ...event.user, ip_address: null };
  // Set server-side by Sentry from the IP; cleared here so a replayed or
  // hand-built event cannot reintroduce it.
  delete user.geo;
  event.user = user;

  return event;
}

/** Scrub header attributes off a standalone span. */
export function scrubSentrySpan(span: SentrySpan): SentrySpan {
  for (const key of Object.keys(span.data)) {
    if (HEADER_ATTR_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      delete span.data[key];
    }
  }
  return span;
}
