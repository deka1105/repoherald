/**
 * The two places where location data is decided.
 *
 * Both are the kind of thing that fails silently and invisibly. `requestCountry`
 * reads an HTTP header, so the failure mode is a visitor choosing what lands in
 * our database. The Sentry scrubbers defend against an upstream *default*
 * changing under us — `sendDefaultPii` is deprecated, and from SDK v11 the
 * `dataCollection` defaults apply, which send the IP — and no type error would
 * ever catch that. So the guard needs a test that fails loudly instead.
 *
 * No database, no network, no key.
 */

import { requestCountry } from "@/lib/analytics";
import { scrubSentryEvent, scrubSentrySpan } from "@/lib/sentry-privacy";

let pass = 0,
  fail = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) pass++;
  else fail++;
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}`);
};

// ── requestCountry: what we deliberately DO collect ──────────────────────────

/** A header bag holding one value, like an incoming request's. */
const hdr = (value: string | null, name = "x-vercel-ip-country") => ({
  get: (k: string) => (k === name ? value : null),
});

ok("resolves a country code", requestCountry(hdr("IN")) === "IN");
ok("upper-cases a lowercase code", requestCountry(hdr("de")) === "DE");
ok("no header means no country", requestCountry(hdr(null)) === null);
ok("empty header means no country", requestCountry(hdr("")) === null);

// ZZ is what the edge returns when it cannot place an address. Dropping it
// keeps "unknown" as one value in the data rather than two.
ok("drops ZZ (edge could not resolve)", requestCountry(hdr("ZZ")) === null);
ok("drops zz regardless of case", requestCountry(hdr("zz")) === null);

// The header is platform-set on Vercel, but the same code runs behind
// `next dev` and could run behind another proxy, so it is validated not
// trusted. Anything that is not exactly two ASCII letters is refused.
ok("refuses three letters", requestCountry(hdr("USA")) === null);
ok("refuses one letter", requestCountry(hdr("U")) === null);
ok("refuses digits", requestCountry(hdr("12")) === null);
ok("refuses whitespace", requestCountry(hdr("I N")) === null);
ok("refuses non-ASCII letters", requestCountry(hdr("ÅÄ")) === null);
ok("refuses a 512-byte string", requestCountry(hdr("A".repeat(512))) === null);
ok(
  "refuses an injection attempt",
  requestCountry(hdr("IN'; DROP TABLE analytics_events;--")) === null
);

// Country is the only geo header we read. The edge offers more; we take none.
ok("ignores the city header", requestCountry(hdr("Mumbai", "x-vercel-ip-city")) === null);
ok(
  "ignores the latitude header",
  requestCountry(hdr("19.0760", "x-vercel-ip-latitude")) === null
);

// ── Sentry scrubbers: what must never leave the process ─────────────────────

const event = scrubSentryEvent({
  message: "boom",
  request: {
    url: "https://repoherald.com/repos/x",
    headers: {
      "x-forwarded-for": "203.0.113.42",
      "x-vercel-ip-country": "IN",
      "x-vercel-ip-city": "Mumbai",
      "x-vercel-ip-latitude": "19.0760",
      // The custom header @sentry/core's substring deny list would MISS.
      "x-geo-country": "IN",
      "user-agent": "Mozilla/5.0",
    },
    cookies: { __session: "abc" },
  },
  user: {
    id: "u1",
    ip_address: "203.0.113.42",
    geo: { country_code: "IN", city: "Mumbai" },
  },
} as Parameters<typeof scrubSentryEvent>[0]);

ok("drops request headers", event.request?.headers === undefined);
ok("drops request cookies", event.request?.cookies === undefined);
ok("keeps the request url", event.request?.url === "https://repoherald.com/repos/x");
ok("keeps the user id", event.user?.id === "u1");
ok("drops Sentry's derived geo", event.user?.geo === undefined);
// Null, not absent: null is what stops Sentry inferring the address from the
// connection the event arrived on.
ok("pins ip_address to null", event.user?.ip_address === null);
ok("no city survives", !JSON.stringify(event).includes("Mumbai"));
ok("no address survives", !JSON.stringify(event).includes("203.0.113.42"));
ok("no coordinates survive", !JSON.stringify(event).includes("19.0760"));

const bare = scrubSentryEvent({ message: "bare" } as Parameters<
  typeof scrubSentryEvent
>[0]);
ok("pins ip_address even with no user on the event", bare.user?.ip_address === null);

const span = scrubSentrySpan({
  span_id: "s",
  trace_id: "t",
  start_timestamp: 0,
  is_segment: false,
  data: {
    "http.request.header.x_vercel_ip_city": "Mumbai",
    "http.request.header.x_forwarded_for": "203.0.113.42",
    "http.response.header.x_vercel_id": "bom1::abc",
    "http.request.method": "GET",
    "http.route": "/repos/[id]",
  },
} as Parameters<typeof scrubSentrySpan>[0]);

ok(
  "drops request-header span attributes",
  !("http.request.header.x_vercel_ip_city" in span.data)
);
ok(
  "drops response-header span attributes",
  !("http.response.header.x_vercel_id" in span.data)
);
ok("keeps the request method", span.data["http.request.method"] === "GET");
ok("keeps the route", span.data["http.route"] === "/repos/[id]");
ok("no city survives in a span", !JSON.stringify(span).includes("Mumbai"));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
