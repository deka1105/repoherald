# Reel 03 — "The formula no platform will show you"

- **Target length:** 30s
- **Hook type:** Exposing / Secret Info
- **Psychology:** Secret Info, Authority Hijacking, Extreme Value, Save CTA
- **Status:** Safe to post now
- **Post order:** 2nd

---

## HOOK (0–3s)

> "No platform will ever show you the formula that decides what you see. Here's mine."

`[SECRET INFO + implied CONTROVERSY — positions against the big platforms by contrast, never naming them]`

## BUILD-UP (3–8s)

> "Not a description of it. The actual line."

`[RISK REVERSAL — promises proof, not a claim]`

## VALUE (8–24s)

> "Score equals log of one plus stars — so going from ten to twenty matters, going from a thousand to a thousand and ten doesn't."

`[EXTREME VALUE — viewers pause here]`

> "Minus age in hours over forty-eight. So everything decays, and nothing is permanently at the top."

> "Plus a hundred, times how many minutes of highlight are left over sixty. That's the part you buy with a credit — and it ticks down in real time."

> "That's it. Likes aren't in it. Comments aren't in it. Who you follow isn't in it, because there's no following."

`[UNEXPECTED TWIST — the absences are the point]`

## PAYOFF (24–28s)

> "Every value in that line is something a person did on purpose. That was the whole design goal."

## CTA (28–32s)

> "Save this if you've ever wondered why your post died at 3pm."

`[SAVE CTA — high-intent, and the line is genuinely reference material]`

---

## Shot notes

Put the formula on screen as literal text, one term at a time, syncing with the VO. This is the whole video — hands off keyboard, let them read.

```
score = ln(1 + stars)
      − age_hours / 48
      + 100 × highlight_minutes_remaining / 60
```

## Instagram caption

The exact ranking formula for my feed, on screen. ln(1 + stars) − age/48h + highlight boost. No likes, no follows, no engagement weighting. Save it.

`#algorithm #buildinpublic #devtools #opensource #softwareengineering`

## YouTube Shorts

- **Title:** I'm showing you my feed's actual ranking formula
- **Description:** Three terms, on screen, no description of it — the actual line. No likes, no follows, no engagement weighting.

## Source facts

- `src/lib/feed.ts`: `base_score = ln(1 + stars_count) − epoch(now − created_at)/3600/48`
- `final.score = 100.0 × remaining_minutes / 60 + base_score`
- No follow graph exists in the schema
