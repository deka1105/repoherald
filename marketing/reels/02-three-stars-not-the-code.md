# Reel 02 — "Your repo has 3 stars and it isn't because it's bad"

- **Target length:** 60s
- **Hook type:** Controversy → Pain Point
- **Psychology:** Controversy, Pain Points, Mind Read, Desired Outcome, Commitment/Identity, Actionable Value
- **Status:** HOLD until GitHub sign-in is enabled in Clerk — this is the one script that is really an ad
- **Post order:** 5th (or 1st on launch day)

---

## HOOK (0–3s)

> "Your repo has three stars, and it's not because the code is bad."

`[CONTROVERSY — challenges the belief every indie dev privately holds about themselves]`

## BUILD-UP (3–11s)

> "I know, because I've read a lot of them now. The code is usually fine."

`[PERSONAL AUTHORITY — quiet, no numbers claimed]`

> "The problem is that every place you could post it rewards something other than the code."

`[MIND READ — clears 'my project just isn't good']`

## VALUE (11–48s)

> "Think about where you'd post. Reddit rewards whoever's awake in the right timezone. Hacker News rewards the first ninety minutes. Twitter rewards how many people already follow you."

`[PAIN POINTS — three specific, universally felt]`

> "None of those are 'is this worth opening'. They're all 'who already has an audience'."

> "So I built the feed differently. The only free thing that moves a repo up is a star somebody actually gave — verified against GitHub with their own token, not mine."

`[ACTIONABLE INSIGHT]`

> "And starring someone else's repo is what earns you the right to promote yours. One star, one credit. One credit is an hour at the top of the feed for your project — or fifteen minutes you can donate to somebody else's."

`[EXTREME VALUE — the whole mechanic, given away]`

> "Likes and comments are on every card. They're not in the ranking formula at all. You can't brigade it, because there's nothing to brigade."

`[UNEXPECTED TWIST — the opposite of what every platform does]`

## PAYOFF (48–55s)

> "Which means the only way to get your repo seen is to go look at other people's. That's not a growth hack. That's just the trade."

`[COMMITMENT/IDENTITY — assigns an identity worth having]`

## CTA (55–60s)

> "It's called repoherald. Comment REPO and I'll send you the link when GitHub sign-in is live."

`[RECIPROCITY + honest — no fake urgency, builds a launch list]`

---

## Instagram caption

Every place you can post a side project rewards your audience, not your project. So I built one where the only free lever is a star someone actually gave. Comment REPO for the link at launch.

`#indiehackers #buildinpublic #opensource #github #devtools`

## YouTube Shorts

- **Title:** Your GitHub repo has 3 stars and the code isn't the problem
- **Description:** Every place you can post a side project ranks your audience, not your project. Here's a feed where the only free lever is a star someone actually gave.

## Source facts

- Feed score: `ln(1 + stars) − age_hours/48 + 100 × highlight_minutes_remaining/60`
- `like_count` and `comment_count` are selected and displayed but absent from the score
- Star verification uses the starring user's own token: `GET /user/starred/{owner}/{repo}`
- 1 credit = 60 min self-highlight, or 15 min donated to another repo
