# Reel 05 — "A currency backed by GitHub stars"

- **Target length:** 90s
- **Hook type:** Burning Question
- **Psychology:** Burning Question, Hype, Extreme Value, Scarcity, Unexpected Twist
- **Status:** Safe to post now; CTA becomes a launch CTA once GitHub sign-in is enabled
- **Post order:** 4th

---

## HOOK (0–3s)

> "What happens if you make a currency where the only way to print it is to do something nice for a stranger?"

`[BURNING QUESTION — philosophical framing on a technical build; high mass appeal]`

## BUILD-UP (3–14s)

> "I've been building this for weeks and I still don't know if it works at scale."

`[PERSONAL AUTHORITY — admitting uncertainty reads as honesty, not weakness]`

> "But the economics are finished, and they're weirder than I expected."
> "Ninety seconds, whole system."

`[HYPE]`

## VALUE (14–72s)

> "You sign in, you get ten credits. Once, ever — the database enforces that with a unique index, so even two simultaneous sign-ins can't double it."

`[EXTREME VALUE — implementation detail devs respect]`

> "After that, you print credits one way: you star a listed repo on GitHub, and you claim it. I check with GitHub, using your token. Six a day, twenty a week."

> "One credit buys an hour at the top of the feed — for your own repo."

> "Or fifteen minutes for someone else's. Same credit, quarter of the time. Helping someone costs you four times as much as helping yourself, and people still do it."

`[UNEXPECTED TWIST — the most interesting economic fact in the whole system]`

> "You can also earn twelve credits in one go. File a real GitHub issue on a listed repo. Wait seven days. If the maintainer hasn't labelled it duplicate, invalid, or wontfix — it pays."

`[EXTREME VALUE + SCARCITY — one per repo, ever]`

> "The credits are a ledger. Append-only. Your balance is a cache of that ledger, and it's allowed to go negative — because refusing to record a clawback would be worse than showing you a debt."

> "And they expire after twelve months. Hoarding isn't a strategy."

## PAYOFF (72–84s)

> "So the only way to be rich here is to have recently paid attention to other people's work. You can't save it, you can't farm it, and you can't buy the part that matters."

`[PAYOFF — resolves the opening question completely]`

## CTA (84–90s)

> "I'll post the day it opens. Comment CREDIT and I'll make sure you see it."

---

## Shot notes

This one carries on the voice — keep cuts slow. Show the ledger table and the unique index on screen for the "once, ever" line. The 60-vs-15-minute asymmetry deserves a simple graphic.

## Instagram caption

A currency you can only print by starring someone else's repo. Ten credits to start. Six a day after that. Spending one on yourself buys an hour — spending it on a stranger buys fifteen minutes, and people still do it. Comment CREDIT for launch.

`#buildinpublic #indiehackers #opensource #github #systemdesign`

## YouTube Shorts

- **Title:** I made a currency you can only print by helping strangers
- **Description:** Ten credits to start, six a day after. Append-only ledger, balances that can go negative, and credits that expire at twelve months.

## Source facts

- `WELCOME_BONUS_CREDITS = 10`, one per user ever (partial unique index on `credit_entries`)
- `DAILY_MINT_CAP = 6`, `WEEKLY_MINT_CAP = 20`, `CLAIMS_PER_MINUTE = 5`
- `SELF_HIGHLIGHT_MINUTES = 60`, `DONATION_MINUTES = 15`
- `ISSUE_REPORT_CREDITS = 12`, `ISSUE_VALIDATION_DAYS = 7`, one per repo per person
- `CREDIT_TTL_MONTHS = 12`
