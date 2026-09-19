import Link from "next/link";
import { AnalyticsOptOut } from "@/components/analytics-opt-out";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Cookies & Local Storage — repoherald",
  description: "Every cookie and browser storage key repoherald uses, and how to opt out.",
};

export default function CookiesPage() {
  return (
    <>
      <h1>Cookies &amp; local storage</h1>
      <p>
        This is the complete list. {LEGAL.serviceName} sets <strong>three cookies</strong> — one to
        keep you signed in, and two that remember display choices you made. We run no advertising
        cookies, no third-party analytics cookies, and nothing that follows you to other sites.
      </p>

      <h2>Cookies</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Purpose</th>
            <th>Lifetime</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>authjs.session-token</code>
              <br />
              (<code>__Secure-</code> prefixed over HTTPS)
            </td>
            <td>
              Keeps you signed in after GitHub sends you back. Without it every page would log you
              out.
            </td>
            <td>Until you sign out or it expires</td>
          </tr>
          <tr>
            <td><code>rh_theme</code></td>
            <td>
              Your light, dark, or coloured theme choice. A cookie rather than local storage so
              the server can render your theme in the very first byte of the page, instead of
              flashing the default and repainting.
            </td>
            <td>1 year</td>
          </tr>
          <tr>
            <td><code>rh_feed_layout</code></td>
            <td>
              Remembers whether you chose the banner, tile, or hybrid feed layout. It is a cookie
              rather than local storage so the server can render your chosen layout immediately,
              instead of flashing the default first.
            </td>
            <td>1 year</td>
          </tr>
        </tbody>
      </table>
      <p>
        All three are exempt from consent prompts: the session cookie is strictly necessary, and
        the theme and layout cookies store only preferences you set yourself, at the moment you
        set them. None is used to identify or track you, and none is set before you act.
      </p>

      <h2>Local storage</h2>
      <p>
        These stay in your browser and are never sent to us. They remember choices you already
        made, so the interface does not forget them on every visit.
      </p>
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>rh_sponsor_dismissed</code></td>
            <td>Remembers you closed the sponsorship panel, so it stays closed</td>
          </tr>
          <tr>
            <td><code>rh_welcome_seen</code></td>
            <td>Remembers you have seen the welcome guide</td>
          </tr>
          <tr>
            <td><code>rh_promo_seen</code></td>
            <td>Remembers which discount codes you have already been shown</td>
          </tr>
          <tr>
            <td><code>rh_analytics_opt_out</code></td>
            <td>Set only if you opt out of view counting below</td>
          </tr>
          <tr>
            <td><code>rh_theme_sync</code></td>
            <td>Signals a theme change to your other open tabs so they update too</td>
          </tr>
        </tbody>
      </table>
      <p>Clearing your browser storage resets all of these. Nothing breaks.</p>

      <h2>How we count views without cookies</h2>
      <p>
        We measure how many people open a page or a repository, because listing authors want to
        know their work is being seen. We do it without identifying anyone.
      </p>
      <p>
        Your IP address and browser user-agent are combined with a secret that changes every day
        and put through a one-way hash. Only that hash is stored — <strong>never your IP
        address</strong>. Because the secret rotates daily, the same visitor on two days produces
        two unrelated values, so the data cannot be used to build a profile or follow anyone over
        time.
      </p>
      <p>
        This needs no cookie and no consent prompt. We are still giving you the switch, because
        being countable should be your call.
      </p>

      <h2>Opt out of view counting</h2>
      <AnalyticsOptOut />
      <p>
        Opting out stops your browser sending view events at all. It is stored in your browser, so
        set it again on other devices. We also honour your browser’s{" "}
        <a
          href="https://globalprivacycontrol.org/"
          target="_blank"
          rel="noreferrer noopener"
        >
          Global Privacy Control
        </a>{" "}
        signal automatically.
      </p>

      <h2>Third parties</h2>
      <p>
        Pages that take payment hand you to Stripe, which sets its own cookies for fraud
        prevention — see Stripe’s privacy policy. Fonts are served from our own domain, so Google
        Fonts never sees your visit. See <Link href="/privacy">our privacy policy</Link> for the
        full list of processors.
      </p>
    </>
  );
}
