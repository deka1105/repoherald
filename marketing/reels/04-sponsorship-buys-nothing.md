# Reel 04 — "I built a way to take money and made sure it buys nothing"

- **Target length:** 55s
- **Hook type:** Controversy / Bold Statement
- **Psychology:** Controversy, Mind Read, Authority through restraint, Extreme Value, Risk Reversal, Share CTA
- **Status:** Safe to post now
- **Post order:** 3rd

---

## HOOK (0–3s)

> "I built a way for companies to pay me. Then I made sure it can't buy them the thing they actually want."

`[CONTROVERSY — anti-incentive, instantly counterintuitive]`

## BUILD-UP (3–10s)

> "And before anyone says it — yes, I need the money. That's not the flex here."

`[MIND READ — disarms the 'must be nice' objection]`

> "Here's exactly what a sponsorship does and doesn't move."

## VALUE (10–42s)

> "What it buys: two cards pinned above the feed, and one injected into the body at a position that stays stable while you scroll — so nothing jumps under your thumb."

`[ACTIONABLE DETAIL]`

> "All three carry a sponsor label. Not a faint grey one. A label."

> "What it does not buy: search. The search function has no sponsorship term in it. Not weighted low — *absent*. Type a query and you get the same results whether anyone paid or not."

`[EXTREME VALUE — a verifiable claim, not a promise]`

> "And it ends on whichever comes first: the days you bought, or a star cap. Hit seventy-five stars on day two and it's over on day two."

> "If your repo gets deleted off GitHub mid-sponsorship, a job refunds you automatically. You don't email me. There's no ticket."

`[RISK REVERSAL — removes the buyer's real fear]`

## PAYOFF (42–50s)

> "Because the second paying changes what a search returns, the search is worthless — and then the sponsorship is worthless too. Protecting the thing I'm selling means limiting what it sells."

`[PAYOFF — resolves the hook with a principle, not a brag]`

## CTA (50–55s)

> "If you're building something with ads in it, steal this. Share it with whoever's writing your ranking code."

`[SHARE CTA — targets a specific person, which makes shares happen]`

---

## Instagram caption

Sponsorship on my site pins two cards and injects a third — all labelled. It does not touch search. There is no sponsorship term in the search function at all. Here's why limiting what it sells is what makes it worth selling.

`#buildinpublic #indiehackers #productdesign #devtools #startup`

## YouTube Shorts

- **Title:** I built sponsorships that can't buy the thing sponsors want
- **Description:** Two pinned cards, one injected, all labelled — and zero effect on search. Why limiting what an ad can buy is what keeps it worth buying.

## Source facts

- `src/lib/feed.ts`: up to 2 pinned + 1 injected at a bucket-stable seeded position
- `src/lib/search.ts` contains no sponsorship ordering term at all
- `sponsorships.starsCap` ends placement on time **or** stars, whichever first
- Deleted repo → `freezeRepo` + `refundSponsorshipForRepo`, automatic, no ticket
