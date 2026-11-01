import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, scrubSentrySpan } from "@/lib/sentry-privacy";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Same guard as the server runtime, from the same module so the two
    // cannot drift. The browser sends no Vercel geo headers, but it is the
    // runtime whose connection IP Sentry's ingest can see directly, which is
    // what `sendDefaultPii: false` plus a null ip_address refuses.
    sendDefaultPii: false,
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: scrubSentryEvent,
    beforeSendSpan: scrubSentrySpan,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
