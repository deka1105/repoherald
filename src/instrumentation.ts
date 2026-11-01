import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, scrubSentrySpan } from "@/lib/sentry-privacy";

// Dormant until SENTRY_DSN is set in the environment.
export async function register() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      // Stated, not defaulted. This is the value /privacy depends on, so it
      // should be visible here rather than inherited — and `sendDefaultPii`
      // is deprecated, so the day it stops being read we want the grep to
      // land on something. See src/lib/sentry-privacy.ts.
      sendDefaultPii: false,
      beforeSend: scrubSentryEvent,
      beforeSendTransaction: scrubSentryEvent,
      beforeSendSpan: scrubSentrySpan,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
