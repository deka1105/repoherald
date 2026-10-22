# Brag Plan: repoherald (iOS + Android)

## What is this app?
A feed of GitHub repositories that people posted because they thought someone
should see them. Open it, the feed is there, tap a card, it opens on GitHub.
What makes it notable is subtractive: it ships 15 dependencies, no analytics
SDK, no crash reporter, and no advertising ID.

## The angle
The brag is what *isn't* in the app. Every claim is a number that is zero, and
each one is verifiable rather than asserted — the advertising ID absence was
confirmed against the merged release manifest, not inferred from a dependency
list. The video states facts and declines to sell. The product's own copy is
already deadpan ("That is the whole app."), so the video borrows its voice
instead of inventing one.

## Hook (first 2-3 seconds)
Near-black screen, the app's actual background (#0a090c). One line, large,
centered, held still:

    A feed of GitHub repos.

Beat. Then, smaller, underneath:

    That is the whole app.

No motion flourish. The hook is the refusal to oversell — which is unusual
enough in a launch video to buy the next twenty seconds.

## Key moments (the middle)
- The real feed scrolling: repo cards with owner, language, star count, pulled
  from the shipped UI (sherlock / Edge0 / solidcraft).
- A card tap that hands off to GitHub — the entire interaction model.
- Three counters revealed one at a time, each held long enough to sit
  uncomfortably: 0 analytics SDKs, 0 crash reporters, 0 advertising IDs.

## Outro / punchline
    There is nothing to opt out of.

Then the wordmark, letterspaced exactly as the app renders it, and a single
line: iOS and Android.

## User flow worth showing
Entry → key action → result, all three are in the app and all three are short:
1. Open the app. The feed is already there. No sign-in wall, no onboarding.
2. Scroll the feed. Cards show repo, owner, language, stars, description.
3. Tap a card. It opens the repository on GitHub.
Secondary beat if a scene allows it: Credits → "Delete my account", which
removes the account from inside the app with no email and no form.

## Tone
- Preset: deadpan
- Creative direction: a quiet product that refuses to sell itself
- Interpretation: long holds, large empty space, one statement at a time. No
  zooms, no whips, no stacked text. Pace comes from hard stillness broken by
  single clean cuts. Nothing winks at the camera; the humour is that the video
  treats "zero" as a serious product achievement, which it is.

## Format: landscape — 1920x1080
## Duration: 23s target

## Visual identity (from the project)
Exact values from `mobile/src/theme.ts`:
- Background: #0a090c
- Card: #141317
- Hairline / border: #26242b
- Text: #f2f2f0
- Dim text: #8e8c95
- Body text: #b9b7c0
- Accent: #9d78ff
- Display font: system sans (the app ships no custom font). Wordmark treatment
  is uppercase, weight 800, letter-spacing 3 — match it exactly.
- Body font: same system sans, weights 400-700.
- Strongest visual element: the repo card — #141317 on #0a090c, generous
  padding, avatar left, star count right, language label in dim grey.

## Source material
- `mobile/screenshots/iphone-6.3/01-feed.png` (1206x2622) — reference only
- `mobile/playstore/phone/01-feed.png`, `02-feed-scrolled.png` (1080x2400)

### Do not screen-capture the feed verbatim
The shipped screenshots include a card for `simplifaisoul/osiris` whose
description carries a Solana token address. Recreate the cards in HTML using
three of the other real repos (sherlock / Edge0 / solidcraft) and omit that
card. A token address in a launch video reads as crypto promotion and is not
what the product is.

## Share copy (draft)
My app's best feature is a number that is zero: no analytics SDK, no crash
reporter, no advertising ID. A feed of GitHub repos people actually wanted to
show someone. iOS and Android.

## Audio direction
- Role: low, sparse bed — present but refusing to drive the edit
- Music: `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` (114.84 BPM)
- Music treatment: enter at ~0.8s under the hook, sit low throughout, duck
  further beneath the three counters, and fade out entirely before the final
  line so "There is nothing to opt out of." lands in near-silence. The gap is
  the point.
- Music cue guidance: preset read from
  `assets/music/cues/happy-beats-business-moves-vol-9-...music-cues.md`.
  Strong cues in window: 4.23, 6.34, 8.44, 10.54, 12.65, 23.17s.
  Beat grid is ~0.52s; every 4th beat is ~2.1s apart, which matches the
  counter hold floor. Align the three counter reveals to consecutive strong
  cues (~2.1s apart) — never to adjacent beats, which would rush them.
- Audio-reactive treatment: none. Deadpan means nothing on screen should
  visibly pulse to music.
- SFX posture: sparse. At most three cues in the whole video — one soft
  interface tick per counter arrival, nothing on the cuts.
- Audio-coupled moments: the three counter arrivals; optionally one dry tap
  sound on the card press in Scene 2.
- Restraint rule: no risers, no whooshes, no impacts, no music swell on the
  outro. If a cue would make the video feel like an ad, drop it.

## Storyboard

### Scene 1 — The whole app — 5s
Near-black #0a090c. "A feed of GitHub repos." enters in 0.4s, large, centered,
then holds completely still. At 2.4s, "That is the whole app." fades in beneath
it in #8e8c95 at roughly half the size. Both lines remain to the cut.
Sequential/interaction: yes — two lines, second arrives at 2.4s, each held well
past its reading floor (1.2s and 1.5s respectively).
Audio intent: music barely present, establishing calm rather than momentum.
Audio-coupled idea: none. The hook is silent on purpose.
Music: low bed, entering under the first line.
Transition mood: clean, slow crossfade → Scene 2

### Scene 2 — The feed, in use — 7s
A single phone frame, centered, on the same background. Three recreated repo
cards (#141317, hairline #26242b) scroll up at a natural reading speed:
sherlock / Edge0 / solidcraft, each with avatar, owner, language and star count.
At ~4.5s a tap lands on one card and it transitions out to a GitHub handoff.
Caption, lower third, dim: "No account. No onboarding. No email wall."
Sequential/interaction: yes — cards scroll in sequence, then a simulated tap on
the middle card at ~4.5s.
Audio intent: the bed continues unchanged; the product does the talking.
Audio-coupled idea: one dry interface tap matched to the card press.
Music: unchanged low bed.
Transition mood: clean hard cut → Scene 3

### Scene 3 — The zeros — 7s
Back to empty background. Three lines arrive one at a time, left-aligned,
stacked with generous leading, each holding ~2.1s and all three remaining on
screen at the end:
    0   analytics SDKs
    0   crash reporters
    0   advertising IDs
The numeral in #9d78ff, the label in #f2f2f0. No icons, no cards, no borders.
Sequential/interaction: yes — three text reveals on consecutive strong cues
~2.1s apart. Each holds past the 0.8s label floor by a wide margin; all three
stay visible together for the final ~1s.
Audio intent: music ducks; each arrival is the loudest thing in the mix.
Audio-coupled idea: one soft interface tick per line.
Music: ducked bed.
Transition mood: clean cut, slightly longer black → Scene 4

### Scene 4 — Nothing to opt out of — 4s
Music has already faded. "There is nothing to opt out of." appears alone,
centered, and holds in silence for ~2.2s. It then fades and the wordmark
replaces it: REPOHERALD in #f2f2f0, uppercase, weight 800, letter-spacing 3,
with "iOS and Android" beneath in #8e8c95.
Sequential/interaction: yes — line first, wordmark second, never together.
Audio intent: silence. The absence of a music button is the joke.
Audio-coupled idea: none.
Music: faded out before the line appears.
Transition mood: hold to black.

**Music mood for this video:** deadpan — a low corporate bed that quietly
withdraws before the final statement.
**Audio summary:** A restrained bed enters under the hook, carries the product
scene unchanged, ducks beneath three counter ticks, then disappears entirely so
the last line is delivered in silence.

**Scene durations:** 5 + 7 + 7 + 4 = 23s.
