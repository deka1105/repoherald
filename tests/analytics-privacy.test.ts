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
import { priorConsentRequired } from "@/lib/consent-region";
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
  requestCountry(hdr("IN'; DROP TABLE analytics_events;--")) === null,
);

// Country is the only geo header we read. The edge offers more; we take none.
ok(
  "ignores the city header",
  requestCountry(hdr("Mumbai", "x-vercel-ip-city")) === null,
);
ok(
  "ignores the latitude header",
  requestCountry(hdr("19.0760", "x-vercel-ip-latitude")) === null,
);

// ── priorConsentRequired: which default the visitor gets ────────────────────
//
// A wrong `false` here sets a cookie that needed asking first, in a
// jurisdiction that fines for it. Every uncertain input must read true.

for (const c of ["DE", "FR", "IE", "IT", "PL", "SE"])
  ok(`EU requires prior consent (${c})`, priorConsentRequired(c) === true);
for (const c of ["NO", "IS", "LI"])
  ok(`non-EU EEA requires prior consent (${c})`, priorConsentRequired(c) === true);
ok("UK requires prior consent", priorConsentRequired("GB") === true);
for (const c of ["JE", "GG", "IM"])
  ok(`Crown Dependency requires prior consent (${c})`, priorConsentRequired(c) === true);

for (const c of ["US", "IN", "CA", "AU", "BR", "JP"])
  ok(`outside the zone is opt-out (${c})`, priorConsentRequired(c) === false);
// Excluded on purpose: the revised FADP has no prior-consent rule.
ok("Switzerland is opt-out", priorConsentRequired("CH") === false);

ok("lower case still matches", priorConsentRequired("de") === true);
ok("mixed case still matches", priorConsentRequired("Gb") === true);

// Fail closed: anything we cannot place is treated as inside the zone.
ok("null requires consent", priorConsentRequired(null) === true);
ok("undefined requires consent", priorConsentRequired(undefined) === true);
ok("empty requires consent", priorConsentRequired("") === true);
ok("three letters requires consent", priorConsentRequired("USA") === true);
ok("digits require consent", priorConsentRequired("12") === true);

// Shaped like a country, means "unknown". Must not read as permission.
ok("ZZ requires consent", priorConsentRequired("ZZ") === true);
ok("T1 (Tor) requires consent", priorConsentRequired("T1") === true);
ok("XK user-assigned requires consent", priorConsentRequired("XK") === true);
ok("QM user-assigned requires consent", priorConsentRequired("QM") === true);

// The composition that actually runs in the layout.
ok(
  "an unresolved edge header ends up requiring consent",
  priorConsentRequired(requestCountry(hdr("ZZ"))) === true,
);
ok(
  "a German visitor ends up requiring consent",
  priorConsentRequired(requestCountry(hdr("DE"))) === true,
);
ok(
  "a US visitor ends up on opt-out",
  priorConsentRequired(requestCountry(hdr("US"))) === false,
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
ok(
  "keeps the request url",
  event.request?.url === "https://repoherald.com/repos/x",
);
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
ok(
  "pins ip_address even with no user on the event",
  bare.user?.ip_address === null,
);

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
  !("http.request.header.x_vercel_ip_city" in span.data),
);
ok(
  "drops response-header span attributes",
  !("http.response.header.x_vercel_id" in span.data),
);
ok("keeps the request method", span.data["http.request.method"] === "GET");
ok("keeps the route", span.data["http.route"] === "/repos/[id]");
ok("no city survives in a span", !JSON.stringify(span).includes("Mumbai"));

// ── Google Analytics consent: the grant that must never happen by accident ──
//
// `_ga` cookies are not consent-exempt under ePrivacy, so a wrong `true` here
// is a legal problem rather than a bug. Every uncertain case must read false.

// ── The gtag queue: Arguments, not Array ────────────────────────────────────
//
// gtag.js reads a command only when it arrives as array-like Arguments. Push a
// real Array and it is ignored silently: no error, no warning, `config` never
// registers, and the tag sends nothing while the queue looks correct. That
// shipped to production once. This is the check that catches it.

async function gtagQueueTests() {
  const { createGtag } = await import("@/components/google-analytics");
  const dl: unknown[] = [];
  const gtag = createGtag(dl);

  gtag("consent", "default", { analytics_storage: "denied" });
  gtag("config", "G-TEST");

  const first = dl[0] as IArguments;
  ok("queues one entry per call", dl.length === 2);
  ok("queued value is NOT a real Array", Array.isArray(first) === false);
  ok("queued value is array-like", typeof first?.length === "number");
  ok("preserves the command name", first[0] === "consent");
  ok("preserves every argument", first.length === 3);
  ok(
    "preserves the options object",
    (first[2] as Record<string, string>).analytics_storage === "denied",
  );
  ok("config lands as Arguments too", Array.isArray(dl[1]) === false);
}

// Wrapped in an async function because these tests run as CJS, where
// top-level await is unavailable — the same reason nemotron-wire.test.ts
// nests its dynamic import.
async function consentTests() {
  const store = new Map<string, string>();
  const gpc: { globalPrivacyControl?: boolean } = {};

  // defineProperty rather than Object.assign: in Node 23 `navigator` is a
  // getter-only global, so assigning to it throws.
  const define = (name: string, value: unknown) =>
    Object.defineProperty(globalThis, name, {
      value,
      writable: true,
      configurable: true,
    });

  const realStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };

  define("window", {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  });
  define("localStorage", realStorage);
  define("navigator", gpc);

  const consent = await import("@/lib/analytics-consent");
  const EU = true; // priorConsentRequired
  const US = false;

  // ── the stored choice is three-valued ────────────────────────────────────
  store.clear();
  ok("no stored value is 'no choice', not 'no'", consent.gaChoice() === null);
  store.set(consent.GA_CONSENT_KEY, "1");
  ok("'1' is an explicit yes", consent.gaChoice() === true);
  store.set(consent.GA_CONSENT_KEY, "0");
  ok("'0' is an explicit no", consent.gaChoice() === false);
  store.set(consent.GA_CONSENT_KEY, "true");
  ok("a truthy-looking value is not a yes", consent.gaChoice() !== true);

  // ── inside the consent zone: nothing until asked ─────────────────────────
  store.clear();
  ok("EU: no choice means denied", consent.gaStorageGranted(EU) === false);
  store.set(consent.GA_CONSENT_KEY, "1");
  ok("EU: an explicit opt-in grants", consent.gaStorageGranted(EU) === true);
  store.set(consent.GA_CONSENT_KEY, "0");
  ok("EU: an explicit refusal denies", consent.gaStorageGranted(EU) === false);
  store.set(consent.GA_CONSENT_KEY, "true");
  ok(
    "EU: a truthy-looking value does not grant",
    consent.gaStorageGranted(EU) === false,
  );

  // ── outside it: granted until refused ────────────────────────────────────
  store.clear();
  ok("US: no choice means granted", consent.gaStorageGranted(US) === true);
  store.set(consent.GA_CONSENT_KEY, "0");
  ok(
    "US: an explicit refusal denies, and is what makes it stick",
    consent.gaStorageGranted(US) === false,
  );
  store.set(consent.GA_CONSENT_KEY, "1");
  ok("US: an explicit opt-in grants", consent.gaStorageGranted(US) === true);

  // A refusal must be WRITTEN, not stored as absence — otherwise opting out
  // outside the consent zone silently reverts on the next visit.
  store.clear();
  consent.setGaCookiesAllowed(false);
  ok(
    "refusing writes '0' rather than clearing the key",
    store.get(consent.GA_CONSENT_KEY) === "0",
  );
  ok(
    "US: a written refusal survives as denied",
    consent.gaStorageGranted(US) === false,
  );
  consent.setGaCookiesAllowed(true);
  ok("allowing writes '1'", store.get(consent.GA_CONSENT_KEY) === "1");

  // ── the overrides outrank the region in both directions ──────────────────
  store.clear();
  store.set(consent.OPT_OUT_KEY, "1");
  ok("EU: an opt-out denies", consent.gaStorageGranted(EU) === false);
  ok("US: an opt-out denies too", consent.gaStorageGranted(US) === false);
  store.set(consent.GA_CONSENT_KEY, "1");
  ok(
    "an opt-out beats an explicit opt-in",
    consent.gaStorageGranted(US) === false,
  );
  store.delete(consent.OPT_OUT_KEY);
  ok(
    "grant returns once the opt-out is lifted",
    consent.gaStorageGranted(US) === true,
  );

  // Global Privacy Control outranks everything, without the visitor acting.
  gpc.globalPrivacyControl = true;
  ok("GPC denies in the EU", consent.gaStorageGranted(EU) === false);
  ok("GPC denies outside it as well", consent.gaStorageGranted(US) === false);
  ok("GPC also reads as opted out", consent.analyticsOptedOut() === true);
  delete gpc.globalPrivacyControl;

  // ── unreadable storage must never grant, in either region ────────────────
  define("localStorage", {
    getItem: () => {
      throw new Error("storage blocked");
    },
    setItem: () => {
      throw new Error("storage blocked");
    },
    removeItem: () => {
      throw new Error("storage blocked");
    },
  });
  ok("unreadable storage is an explicit no", consent.gaChoice() === false);
  ok(
    "unreadable storage does not grant in the EU",
    consent.gaStorageGranted(EU) === false,
  );
  ok(
    "unreadable storage does not grant outside it either",
    consent.gaStorageGranted(US) === false,
  );
  ok(
    "unreadable storage reads as opted out",
    consent.analyticsOptedOut() === true,
  );
  define("localStorage", realStorage);
}

void gtagQueueTests()
  .then(consentTests)
  .then(() => {
    console.log(`\n  ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
