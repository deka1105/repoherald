import Link from "next/link";
import { LEGAL, hasBusinessIdentity } from "@/lib/legal";

export const metadata = {
  title: "Terms of Service — repoherald",
  description: "The rules for using repoherald.",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>
        These terms cover your use of {LEGAL.serviceName}
        {hasBusinessIdentity() ? <>, operated by {LEGAL.entityName}</> : null}. Using the service
        means you accept them.
      </p>

      <h2>Who can use it</h2>
      <p>
        You must be at least {LEGAL.minimumAge} years old and have a GitHub account in good
        standing. One person, one account. You are responsible for what happens under your account.
      </p>

      <h2>What the service does</h2>
      <p>
        {LEGAL.serviceName} is a place to list public GitHub repositories so other people can find
        and star them. Starring a listed repository can earn credits, which buy time in a highlight
        slot. Sponsorships are paid placements at the top of the feed.
      </p>

      <h2>Listing repositories</h2>
      <ul>
        <li>You may list a public repository you own, or one owned by an organisation you belong to.</li>
        <li>You keep all rights to your code. Listing it grants us only what we need to display it here.</li>
        <li>We may hide or remove a listing that breaks these terms, and we will say why.</li>
      </ul>

      <h2>Credits</h2>
      <p>
        Credits are a feature of the service, not currency. They have no cash value, cannot be
        withdrawn, transferred, or sold, and we may expire unused earned credits after a period
        stated in the product.
      </p>
      <p>
        Credits are earned by actions we can verify. A star claim is checked against GitHub using
        your own token, and checked again later. <strong>If a star is removed inside the
        verification window, the credit it earned is withdrawn</strong> — this is how the economy
        stays honest, and it can make your balance negative until you earn or buy more.
      </p>
      <p>
        Attempting to manufacture credits — reciprocal starring rings, throwaway accounts,
        automation, or claiming stars you did not genuinely give — will cost you the credits and
        may cost you the account.
      </p>

      <h2>Payments</h2>
      <p>
        Prices are shown before you pay, in the currency stated, and that is the amount you are
        charged. There are no setup fees, no subscriptions, and no recurring charges — every
        purchase is one-off and only happens when you confirm it. Payment is handled by Stripe.
      </p>
      <p>
        See <Link href="/refunds">the refund policy</Link> for what happens when something goes
        wrong, including the automatic pro-rata refund when a sponsored repository is removed
        mid-run.
      </p>

      <h2>Acceptable use</h2>
      <p>Do not:</p>
      <ul>
        <li>Post malware, illegal content, or anything you do not have the right to post.</li>
        <li>Harass people in comments, or post spam or unrelated promotion.</li>
        <li>Game the credit system, or use bots to inflate stars, views, likes, or reports.</li>
        <li>Scrape, overload, or try to break the service or its security.</li>
        <li>Impersonate anyone, or misrepresent who owns a repository.</li>
      </ul>

      <h2>Content you post</h2>
      <p>
        Listings, lists, and comments are public. You keep ownership of what you write, and you
        give us permission to display and distribute it as part of the service. Moderators may
        remove content that breaks these rules; removed comments are retained in a hidden state so
        moderation stays auditable.
      </p>

      <h2>Suspension</h2>
      <p>
        We may suspend or close an account that breaks these terms. Where it is fair to do so we
        will warn you first and explain what happened. You can close your account yourself at any
        time from <Link href="/wallet">your wallet</Link>.
      </p>

      <h2>Availability</h2>
      <p>
        The service is provided as-is. We do not promise it will be uninterrupted or error-free,
        and we do not guarantee that listing a repository will get it stars, users, or attention.
        Star counts and other figures come from GitHub and may lag.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential losses, and
        our total liability for any claim is limited to what you paid us in the twelve months
        before it arose. Nothing here limits liability that cannot legally be limited.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. If a change materially affects you we will update the date below
        and tell account holders by email. Continuing to use the service after a change means you
        accept it.
      </p>

      <h2>Governing law</h2>
      <p>
        {LEGAL.jurisdiction
          ? `These terms are governed by the laws of ${LEGAL.jurisdiction}.`
          : "The governing law is the jurisdiction in which the operator is established."}
      </p>

      <h2>Contact</h2>
      <p>
        Reach us through <Link href="/support">the support form</Link>
        {LEGAL.contactEmail ? (
          <>
            {" "}
            or at <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
          </>
        ) : null}
        .
      </p>
    </>
  );
}
