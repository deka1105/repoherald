"use client";

import { Analytics } from "@vercel/analytics/next";
import { analyticsOptedOut } from "@/lib/analytics-consent";

/**
 * Vercel Web Analytics, behind our own opt-out.
 *
 * The SDK has no idea our switch exists, so left to itself it would keep
 * reporting for someone who had turned view counting off — and /cookies says
 * in plain words that opting out "stops your browser sending view events at
 * all". That sentence has to be true of every measurement on the page, not
 * just the one we wrote, so this is a correctness fix rather than a courtesy.
 *
 * `beforeSend` returning null drops the event before it is sent. Checked per
 * event rather than at mount, matching src/lib/track-client.ts: toggling the
 * switch takes effect on the very next event without a reload. It also
 * inherits `analyticsOptedOut`'s fail-closed behaviour, so a browser whose
 * storage cannot be read counts as opted out here too, and Global Privacy
 * Control is honoured without the visitor finding our switch.
 *
 * This is a client component because `beforeSend` is a function: a server
 * component cannot pass one across the boundary.
 */
export function VercelAnalytics() {
  return <Analytics beforeSend={(event) => (analyticsOptedOut() ? null : event)} />;
}
