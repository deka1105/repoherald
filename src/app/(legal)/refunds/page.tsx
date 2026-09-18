import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Refund Policy — repoherald",
  description: "When repoherald refunds sponsorships and credit purchases, and how to ask.",
};

export default function RefundsPage() {
  return (
    <>
      <h1>Refund Policy</h1>
      <p>
        {LEGAL.serviceName} sells two things: <strong>sponsorships</strong>, which place a
        repository at the top of the feed, and <strong>credit packs</strong>, which buy highlight
        time. This explains what happens to your money in each case. It describes what the system
        actually does, including the refunds it issues automatically.
      </p>

      <h2>What you are buying</h2>
      <p>
        A sponsorship runs until <strong>whichever limit comes first</strong>: its number of days,
        or its star cap. A 7-day slot that also carries a 75-star cap ends when the repository has
        gained 75 stars since the sponsorship started, even if that happens on day two. This is
        stated on the purchase page before you pay and is not a reduction of what you bought — the
        cap is the product.
      </p>
      <p>
        Credits buy highlight time: one credit is one hour of highlighting your own repository, or
        fifteen minutes donated to someone else&rsquo;s.
      </p>

      <h2>Automatic refunds</h2>
      <p>
        If a sponsored repository is removed from {LEGAL.serviceName} while its sponsorship is
        still running — for example, it is taken down by moderation, or it is deleted or made
        private on GitHub — the system issues a <strong>pro-rata refund of the unused time,
        without you asking</strong>. The refund is calculated from the moment the sponsorship ends
        early, returned to the original payment method through Stripe, and recorded in our audit
        log.
      </p>
      <p>
        You do not need to contact us for this. If a repository disappears mid-run, the money for
        the remaining time comes back.
      </p>

      <h2>Sponsorships</h2>
      <ul>
        <li>
          <strong>Before it goes live:</strong> full refund. A sponsorship activates when payment
          completes, so this applies to anything paid for but not yet started.
        </li>
        <li>
          <strong>After it goes live:</strong> the placement has been delivered, so we do not
          refund by default. If it did not work as described — it never appeared in the feed, or
          it ended early for a reason other than its stated day or star limit — tell us and we
          will refund the affected portion.
        </li>
        <li>
          <strong>Ended by its star cap:</strong> not refundable. Reaching the cap means the
          sponsorship did its job.
        </li>
      </ul>

      <h2>Credit packs</h2>
      <ul>
        <li>
          <strong>Unspent credits:</strong> refundable within 14 days of purchase. We reverse the
          charge and remove the same number of credits from your balance.
        </li>
        <li>
          <strong>Already spent on a highlight:</strong> not refundable once the highlight has
          run, since the placement was delivered.
        </li>
        <li>
          If a refund would leave your balance short — because you spent credits after buying them
          — your balance can go negative. Earning or buying credits later clears that first.
        </li>
      </ul>
      <p>
        Credits earned by starring repositories, sharing, or reporting issues are not purchases and
        have no cash value, so they cannot be refunded or withdrawn.
      </p>

      <h2>Chargebacks and disputes</h2>
      <p>
        If a payment is disputed or reversed through Stripe, the credits or placement it paid for
        are withdrawn. We would much rather you asked us first — we can usually resolve it faster
        than a bank can.
      </p>

      <h2>Statutory rights</h2>
      <p>
        Nothing here removes rights you have by law. If you are a consumer in the UK or EU you may
        have a 14-day right to cancel distance purchases; where that applies it takes precedence
        over this policy. Note that by asking for a sponsorship to start immediately you may be
        agreeing to begin the service within that period.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Use <Link href="/support">the support form</Link>
        {LEGAL.contactEmail ? (
          <>
            {" "}
            or email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
          </>
        ) : null}
        , and include the repository and roughly when you paid. We aim to reply within a few
        business days. Approved refunds go back to the original payment method; how quickly it
        lands after that is up to your bank, typically 5–10 business days.
      </p>
    </>
  );
}
