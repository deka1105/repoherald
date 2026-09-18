import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Privacy Policy — repoherald",
  description: "What repoherald collects, why, and how to get it deleted.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>
        This describes exactly what {LEGAL.serviceName} stores, why, and how to get rid of it.
        It is written to match what the software actually does.
      </p>

      <h2>What we collect</h2>

      <h3>When you sign in</h3>
      <p>
        Sign-in is GitHub-only — we never see or store a password. GitHub gives us, and we keep:
      </p>
      <ul>
        <li>Your GitHub numeric ID, username, display name, and avatar URL.</li>
        <li>Your email address, used for account-related mail and any alerts you opt into.</li>
        <li>
          Your account-created date, public repository count, and follower count. These are used
          only to judge whether an account is established enough to earn credits, which is how we
          keep fake accounts from minting them.
        </li>
        <li>
          An access token, so we can confirm you really starred a repository you claim credit for.
          It is encrypted at rest with AES-256-GCM. We request read-only scopes
          (<code>read:user</code>, <code>user:email</code>) — we cannot write to your repositories,
          and we cannot star anything on your behalf.
        </li>
      </ul>

      <h3>When you use the site</h3>
      <ul>
        <li>Repositories you post, lists you create, and comments you write — all public by design.</li>
        <li>Likes, star claims, credit ledger entries, and highlight purchases.</li>
        <li>Support messages you send us, including the email address you give.</li>
      </ul>

      <h3>Usage measurement</h3>
      <p>
        We count page and repository views ourselves, without cookies and without a third-party
        analytics vendor. Instead of storing who you are, we derive a visitor number: your IP
        address and browser user-agent are combined with a secret that rotates every day and run
        through a one-way hash. We store only that hash.
      </p>
      <p>
        <strong>Your IP address is never written to our database.</strong> Because the secret
        changes daily, the same person on two different days produces two unrelated values, so the
        record cannot be used to follow anyone over time. We also reduce referrer URLs to the
        hostname alone and drop known bots. You can switch this off entirely — see{" "}
        <Link href="/cookies">Cookies &amp; local storage</Link>.
      </p>

      <h3>Payments</h3>
      <p>
        Card details go directly to Stripe and never touch our servers. We keep the Stripe
        identifiers for your purchase, the amount, and its status, because we need them to grant
        what you paid for and to handle refunds.
      </p>

      <h2>What we do not collect</h2>
      <ul>
        <li>No passwords — authentication is delegated to GitHub.</li>
        <li>No card numbers — those stay with Stripe.</li>
        <li>No advertising or cross-site tracking identifiers, and no data sold or brokered.</li>
        <li>No private repository contents, and no write access to anything you own.</li>
        <li>No location beyond what a hostname or hashed visitor number implies.</li>
      </ul>

      <h2>Who else processes your data</h2>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Purpose</th>
            <th>What it receives</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>GitHub</td>
            <td>Sign-in and star verification</td>
            <td>Your OAuth session and token use</td>
          </tr>
          <tr>
            <td>Neon</td>
            <td>Database hosting</td>
            <td>Everything described above, at rest</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>Application hosting</td>
            <td>Standard request logs, including IP</td>
          </tr>
          <tr>
            <td>Stripe</td>
            <td>Payments</td>
            <td>Your payment details and email</td>
          </tr>
          <tr>
            <td>Resend</td>
            <td>Outbound email</td>
            <td>Your email address and message content</td>
          </tr>
          <tr>
            <td>Sentry</td>
            <td>Error monitoring</td>
            <td>Diagnostics when something breaks</td>
          </tr>
        </tbody>
      </table>
      <p>
        Each is a processor acting on our instructions. We do not sell personal data, and nothing
        here is an advertising network.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account data: until you delete your account.</li>
        <li>
          Credit ledger and audit records: retained after deletion, under an anonymised identifier.
          These are financial records — we keep the amounts and keep them accurate, but they stop
          being connected to you.
        </li>
        <li>Usage measurements: aggregated counts only; the daily hash is meaningless after its day.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Depending on where you live you may have rights to access, correct, export, or erase your
        personal data, and to object to some processing. We honour these regardless of where you
        live.
      </p>
      <ul>
        <li>
          <strong>Delete your account.</strong> Signed in, go to{" "}
          <Link href="/wallet">your wallet</Link> and use “Delete account”. This removes your
          tokens and personal details immediately and hides your listings.
        </li>
        <li>
          <strong>No account, or cannot sign in?</strong> Send a deletion or access request through{" "}
          <Link href="/support">support</Link>
          {LEGAL.contactEmail ? (
            <>
              {" "}
              or email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
            </>
          ) : null}
          . We will respond within 30 days.
        </li>
        <li>
          <strong>Stop the emails.</strong> Sponsor alerts are off unless you turn them on, and
          every one carries a one-click unsubscribe link.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        {LEGAL.serviceName} is not directed at children. You must be at least {LEGAL.minimumAge} to
        hold an account, which matches GitHub’s own minimum. We do not knowingly collect data from
        children under {LEGAL.minimumAge}; if we learn that we have, we delete it. If you believe a
        child has given us data, contact us and we will remove it.
      </p>

      <h2>Security</h2>
      <p>
        Traffic is served over HTTPS. GitHub access tokens are encrypted at rest. Administrative
        actions that touch money, credits, or roles are recorded in an audit log.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this in a way that materially affects you, we will update the date below and,
        where the change is significant, tell account holders by email.
      </p>
    </>
  );
}
