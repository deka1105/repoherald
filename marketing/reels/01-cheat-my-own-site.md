# Reel 01 — "I tried to cheat my own site"

- **Target length:** 45s
- **Hook type:** Challenge / Test
- **Psychology:** Burning Question, Mind Read, Risk Reversal, Extreme Value, Unexpected Twist, Reciprocity CTA
- **Status:** Safe to post now (no sign-up CTA)
- **Post order:** 1st

---

## HOOK (0–3s)

> "I built a site where starring someone's repo earns you promotion. Then I spent a week trying to cheat it."

`[CHALLENGE — genuine uncertainty: did he break it or not?]`

## BUILD-UP (3–9s)

> "And no, I don't mean rate limits. Rate limits are the easy part."

`[MIND READ — kills the predicted payoff]`

> "Four attacks, and what stopped each one. Under a minute."

`[RISK REVERSAL — bounded time cost]`

## VALUE (9–38s)

> "Attack one: star the repo, claim the credit, unstar it an hour later. A job runs nightly and re-asks GitHub — using *your* token, not mine. Star's gone, credit comes back off you. Your balance can go negative. That window stays open for a hundred days."

`[EXTREME VALUE — real mechanism, screen-recordable]`

> "Attack two: fine, unstar and re-star to mint it again. No. The mint row is permanent. Revoked still counts as used. One unique row per user per repo, forever."

`[UNEXPECTED TWIST]`

> "Attack three: make a second account. Your GitHub has to be ninety days old — or thirty days with three repos and two followers. A throwaway gets no welcome credits and can't mint at all."

> "Attack four: me and a friend star each other all week."

`[PAIN POINT — the attack everyone's actually thinking of]`

## PAYOFF (38–44s)

> "That's the one I couldn't close. Two people who genuinely like each other's work look *identical* to two people farming. So it's a review queue, not a ban — because getting that wrong costs more than the credit is worth."

`[PAYOFF — honest limitation = maximum credibility with devs]`

## CTA (44–48s)

> "The whole ranking formula and every anti-gaming rule is written up. Comment STARS and I'll send it."

`[RECIPROCITY — keeps giving, and it's a real deliverable]`

---

## Shot notes

Screen recording of the actual `star_mints` schema on the unique index line. Cut to the nightly cron. Face-to-cam for the payoff only.

## Instagram caption

I built a star-for-promotion system, then spent a week attacking it. Three holes closed, one that can't be — and why I left it open on purpose. Comment STARS for the full write-up.

`#buildinpublic #indiehackers #github #softwareengineering #sideproject`

## YouTube Shorts

- **Title:** I spent a week trying to cheat my own website
- **Description:** Four attacks on a star-for-credit system and what stopped each one. The fourth one can't be fixed — here's why I stopped trying.

## Source facts

- `star_mints` is permanent; `UNIQUE (user_id, repo_id)` — a revoked row still blocks re-minting forever
- Nightly re-verification claws credits back for 100 days; `users.credit_balance` may go negative
- `computeMintEligible`: 90+ days old, or 30+ days with 3+ public repos and 2+ followers
- `/admin/anomalies` surfaces reciprocal claiming as a review queue, explicitly not a verdict
