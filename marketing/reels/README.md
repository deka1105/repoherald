# Reel / Shorts scripts

Short-form vertical video scripts for repoherald, for Instagram Reels and YouTube
Shorts. Same cuts on both platforms; each file carries its own IG caption and its
own Shorts title, because the two do different jobs:

- On **Shorts**, the title is in the feed and is searchable, so the on-screen text
  in the first second should repeat the title rather than restate the voiceover.
- On **Reels**, most plays are muted, so the hook goes on screen as text.

Written against the product doc, with a "Source facts" block at the foot of each
script naming where in this repo each claim comes from. If you change the caps,
the formula or the sponsorship rules, the matching script is wrong — same rule
`AGENTS.md` applies to the legal pages.

## Posting order

| # | File | Length | Hook type | Status |
| --- | --- | --- | --- | --- |
| 1 | `01-cheat-my-own-site.md` | 45s | Challenge / Test | Ready |
| 2 | `03-ranking-formula.md` | 30s | Exposing / Secret info | Ready |
| 3 | `04-sponsorship-buys-nothing.md` | 55s | Controversy | Ready |
| 4 | `05-currency-backed-by-stars.md` | 90s | Burning question | Ready |
| 5 | `02-three-stars-not-the-code.md` | 60s | Controversy → pain point | **Hold** |

Script 01 leads because adversarial testing travels furthest with a dev audience.

Script 02 is held because it is the only one that is really an ad: its CTA sends
people to sign up, and the earning loop is unreachable until the GitHub
connection is enabled in the Clerk dashboard. Only `oauth_google` is configured
today, so nobody can connect GitHub, list a repo, or mint a credit. Post it on
launch day, first.

## One thing to avoid

Any version of "I built this in X days". The differentiator here is that the
mechanism is unusually well thought through, and speed-flexing undercuts it.
