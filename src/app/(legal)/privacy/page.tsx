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
        Sign-in is handled by <strong>Clerk</strong>, an identity provider. You can sign in with
        GitHub or with Google, and we never see or store a password. Signing in with Google using
        an address that already belongs to a GitHub account here puts you into that same account
        rather than creating a second one; we only match on an address the provider has verified.
      </p>
      <p>
        We keep Clerk&rsquo;s identifier for your account, along with your display name, email
        address and picture.
      </p>
      <p>
        GitHub is optional. If you connect it, GitHub gives us, and we keep:
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
          Signing in on the web or in the iOS app both go through Clerk, which holds the token and
          refreshes it; we read it when we need it and do not keep our own copy. Accounts created by
          an older version of the iOS app, which signed in to GitHub directly, still have a token
          stored here encrypted at rest with AES-256-GCM. Either way we request read-only scopes
          (<code>read:user</code>, <code>user:email</code>) — we cannot write to your repositories,
          and we cannot star anything on your behalf.
        </li>
      </ul>

      <h3>When you use the site</h3>
      <ul>
        <li>Repositories you post, lists you create, and comments you write — all public by design.</li>
        <li>Likes, star claims, credit ledger entries, and highlight purchases.</li>
        <li>Support messages you send us, including the email address you give.</li>
        <li>
          Reports you file against a listing. We store which listing it was, the
          category you picked from a fixed list, and — only if you were signed
          in — that it was you. Reporting from the apps does not require an
          account, and a report filed signed out is not linked to anyone. There
          is no free-text field, so a report cannot contain anything you type.
        </li>
      </ul>

      <p>
        Accounts you block in the iOS or Android app are stored on your device
        and never sent to us. We do not know who you have blocked.
      </p>

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

      <h3>The browser extension</h3>
      <p>
        Our extension is with Mozilla for review and is not published in any store yet, so nobody
        has it unless they loaded it themselves. The Chrome build is the same code and has not been
        submitted. This is how it behaves once you have it: it shows
        whether the GitHub repository you are looking at is listed here.{" "}
        <strong>Browsing GitHub sends us nothing.</strong> The extension periodically
        downloads the public list of listed repositories and checks it on your own machine, so we
        never learn which repositories you visit.
      </p>
      <p>
        It contacts us in only two cases: to refresh that public list every few hours, and to fetch
        the public details of a repository that is <em>already listed here</em> — information
        anyone can see on our feed. Those requests carry no cookies and no account identifier, and
        we do not record them as page views. The extension stores your dismissals and the cached
        list in your browser; nothing about it is sent to us.
      </p>

      <h3>Your Instagram and TikTok handles</h3>
      <p>
        You can tell us the Instagram or TikTok account you send repositories from. Both are
        optional, and we have no way to verify that an account is yours — a handle is a claim, not
        proof, and the only thing it decides is whose private list a find is put into. One account
        can hold a given handle at a time. Clearing it removes the handle and leaves your list and
        its contents alone.
      </p>

      <h3>Repositories people send us on Instagram</h3>
      <p>
        We run a tool that reads the direct messages sent to our own Instagram account and picks
        out links to public GitHub repositories. Where it finds one, we record the repository, the
        link to the post it appeared in, and the Instagram usernames of the person who sent it and
        of the account that originally posted it.
      </p>
      <p>
        Those usernames belong to people who never signed up here, so we keep them narrowly.{" "}
        <strong>They are never published.</strong> They exist so that a moderator reviewing a
        suggestion can see where it came from, and whether one account is pushing the same
        repository repeatedly.
      </p>
      <p>
        <strong>A repository found this way is never put on the feed.</strong> Once a moderator
        approves it, it is filed into a <strong>private list belonging to the person who sent
        it</strong> — matched by the handle on their account — which only they and our staff can
        open. If nobody has claimed the sending handle, there is nobody to file it for and it
        simply waits.
      </p>
      <p>
        Where we cannot tell who sent something — a group thread, say — we record that it is
        unknown rather than guess. If you sent us a repository and would rather we did not keep
        that record, ask and we will delete it; the post link and both usernames go with it.
      </p>

      <h3>The repository identifier</h3>
      <p>
        <Link href="/identify">/identify</Link> turns a post&rsquo;s caption, on-screen text or
        narration into the GitHub repository it refers to. Whatever you paste there is sent to
        Nebius, who run the model that reads it, and to GitHub to check whether the repository it
        proposes actually exists. If a post names nothing at all, a short description from that
        text may also be sent to Tavily to search for it.
      </p>
      <p>
        <strong>We do not store what you submit there.</strong> It is held in memory for the length
        of the request and then gone — there is no transcript, and nothing is attached to your
        account, whether or not you are signed in. The page is rate-limited, which needs to tell
        one visitor from another: that uses the same daily, salted, one-way visitor number
        described under Usage measurement, kept only in memory and never written to our database.
      </p>

      <h2>What we do not collect</h2>
      <ul>
        <li>No passwords — authentication is delegated to Clerk, GitHub and Google.</li>
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
            <td>Google</td>
            <td>Sign-in</td>
            <td>Your OAuth session</td>
          </tr>
          <tr>
            <td>Clerk</td>
            <td>Sign-in and session management</td>
            <td>
              Your name, email address, picture, and the access tokens from the providers you
              connect
            </td>
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
          <tr>
            <td>Nebius</td>
            <td>Working out which repository a post is about</td>
            <td>
              The caption, on-screen text or narration of a post — never your
              account details, and never anything you have not submitted for
              identification
            </td>
          </tr>
          <tr>
            <td>Tavily</td>
            <td>
              Searching for a project that a post describes but never names
            </td>
            <td>A short description taken from that post&rsquo;s own text</td>
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
        <li>
          Instagram-sourced suggestions: kept while a repository is awaiting review and after it
          is promoted, so the trail from suggestion to listing stays auditable. Deleting a
          suggestion deletes the usernames and the post link with it.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Depending on where you live you may have rights to access, correct, export, or erase your
        personal data, and to object to some processing. We honour these regardless of where you
        live.
      </p>
      <ul>
        <li>
          <strong>Delete your account.</strong> On the web, signed in, go to{" "}
          <Link href="/wallet">your wallet</Link> and use “Delete account”. In the iOS app, open the
          account screen and use “Delete my account”. Either one removes your tokens and personal
          details immediately and hides your listings.
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
