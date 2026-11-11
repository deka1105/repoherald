"use client";

import { useEffect } from "react";
import { analyticsOptedOut } from "@/lib/analytics-consent";

const SRC = "https://zero-to-sale.vercel.app/t.js";
const PAGE_TOKEN = "454005ac6b65934d50a29c1f";
const SCRIPT_ID = "zero-to-sale-pixel";

/**
 * Zero to Sale's page-view pixel, landing page only, behind our opt-out.
 *
 * The tag sets no cookies and reads nothing from the page: it requests one
 * 1x1 image on load (`e=view`) and one per form submission (`e=submit`). That
 * request still carries the visitor's IP and user-agent to a third party, so
 * it obeys the same switch as every other measurement here — /cookies promises
 * opting out "stops your browser sending view events at all", and Global
 * Privacy Control is honoured without the visitor finding that switch.
 *
 * Injected from an effect rather than written as a <script> tag, because the
 * opt-out lives in localStorage and can only be read in the browser. The
 * check happens once, before injection: the tag fires its view on load, so
 * there is nothing later to intercept. `analyticsOptedOut` fails closed, so a
 * browser whose storage cannot be read is never reported.
 *
 * The tag finds its page token through `document.currentScript`, which is set
 * for an injected external script too, so the `data-page` attribute works the
 * same as in the vendor's snippet. The id keeps a client-side return to the
 * landing page from loading it twice.
 *
 * Disclosed on /privacy (processor table) and /cookies. Change those in the
 * same commit if this tag, or what it sends, changes.
 */
export function ZeroToSalePixel() {
  useEffect(() => {
    if (analyticsOptedOut()) return;
    if (document.getElementById(SCRIPT_ID)) return;
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SRC;
    s.defer = true;
    s.setAttribute("data-page", PAGE_TOKEN);
    document.body.appendChild(s);
  }, []);
  return null;
}
