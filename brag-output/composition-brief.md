# Hyperframes Composition Brief: repoherald

## Objective
Create a short launch-style brag video for repoherald's iOS and Android apps.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080, 30fps
- Duration: 25s (planned 23s; extended to clear the closing-line reading floor)

## Source Material
- Project root: `~/ClaudeCode/day23/repoherald`
- Primary files read: `mobile/src/theme.ts`, `mobile/App.tsx`, `mobile/package.json`,
  `mobile/APPSTORE.md`, `mobile/android/.../merged_manifests/release/AndroidManifest.xml`
- Product name: repoherald
- Tagline / strongest claim: "That is the whole app." — the product's own line
- Key UI to recreate: the feed card (#141317 on #0a090c, avatar left, stars right,
  language label in dim grey)
- Copy that must appear verbatim:
  - A feed of GitHub repos.
  - That is the whole app.
  - No account. No onboarding. No email wall.
  - There is nothing to opt out of.

## Creative Direction
- Tone preset: deadpan
- Creative direction: a quiet product that refuses to sell itself
- Interpretation: long holds, large empty space, one statement at a time. No zooms,
  no whips, no stacked text. Pace comes from stillness broken by clean cuts.
- Angle: the brag is what *isn't* in the app. Every claim is a number that is zero,
  and each is verifiable rather than asserted — the advertising ID absence was
  confirmed against the merged release manifest, not inferred from dependencies.
- Hook: the hook line is on screen at frame 0, not animated in. Frame 0 is the
  social thumbnail, and deadpan suits a line that is simply already there.
- Outro / punchline: "There is nothing to opt out of." in silence, then the wordmark.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Any invented product UI

## Visual Identity
Exact values from `mobile/src/theme.ts`:
- Background: #0a090c
- Card: #141317 / hairline #26242b
- Text: #f2f2f0 / body #b9b7c0 / dim #8e8c95
- Accent: #9d78ff
- Display + body font: Inter (bundled). The app ships no custom font; Inter is the
  closest neutral match to its system sans.
- Wordmark: uppercase, weight 800, letter-spacing scaled from the app's 3px@14px.

## Storyboard
`brag-output/brag-plan.md` is the creative contract.

1. s1 — The whole app — 5s — hook present at frame 0, understatement at 2.45s
2. s2 — The feed, in use — 7s — three real repo cards, simulated tap, GitHub handoff
3. s3 — The zeros — 7s — three counters, one at a time, all three held together
4. s4 — Nothing to opt out of — 6s — final line in silence, then the end card

## Audio
- Audio role: low, sparse bed that refuses to drive the edit
- Audio arc: enters under the hook, carries the product scene unchanged, ducks
  beneath the counters, disappears entirely before the final line
- Music: `assets/music/happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` (114.84 BPM)
- Music treatment: volume 0.22, fade-in 1.4s, fade-out 2.8s, slot ends at 18.6s so
  Scene 4 plays in silence. The gap is the point.
- Music cue guidance: preset read from the bundled cue file. Strong cues in window:
  4.23 / 6.34 / 8.44 / 10.54 / 12.65 / 23.17s. Grid ~0.52s.
  - **beat-locked**: card 2 at 6.34s abs — a strong cue, the one hard lock.
  - **beat-grid**: cards at 5.28 / 6.34 / 7.40s (every other beat, ~1.06s apart).
  - **beat-grid**: counters 2 and 3 at 14.22 / 16.34s (~2.1s apart). Counter 1 is
    deliberately *not* locked to the 12.65 strong cue — doing so left 0.65s of dead
    black after the cut, which the review sheet caught. Readability over the grid.
- Audio-reactive treatment: none. Deadpan means nothing on screen pulses to music.
- Audio-coupled moments:
  - card press at 9.50s — one dry interface click
  - three counter arrivals — one soft tick each, three different takes, not one
    sound repeated
- SFX posture: sparse. Four cues in 25 seconds. Nothing on the cuts.
- Restraint rule: no risers, whooshes, impacts, or music swell on the outro.

## Implementation notes
- Four sub-compositions, one scene each, mounted from the root. The root holds only
  scene hosts and audio.
- `data-layout-ignore` on UI chrome that is texture rather than reading copy
  (wordmark, owner handle, star counts, language labels).
- `data-layout-allow-occlusion` on the GitHub handoff overlay: it covers the card
  stack on purpose, because that is what leaving the app looks like.
- Descriptions trimmed to <=9 words so every card clears its reading floor before
  the handoff covers the stack.

## Gate
`npx hyperframes check` — passes with 0 errors and 0 warnings across lint, runtime,
layout, motion, contrast and craft.
