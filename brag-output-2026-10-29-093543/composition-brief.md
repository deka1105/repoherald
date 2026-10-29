# Hyperframes Composition Brief: repoherald

## Objective
Create a short launch-style brag video for repoherald — specifically for the
thing the product is *for*: getting back a repository you saved somewhere and
lost. The NVIDIA Nemotron / Nebius Token Factory work appears as the hard step
inside that rescue, not as a separate capability demo.

## Output
- Composition directory: `brag-output-2026-10-29-093543/composition/`
- Rendered video: `brag-output-2026-10-29-093543/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 21.7s as rendered (5 scenes: 4.2 / 2.9 / 5.45 / 3.274 / 6.1;
  planned 21s — see `brag-plan.md` → Scene duration check for why it moved)

## Source Material
- Project root: `/Users/shubhamarundekatey/ClaudeCode/day23/repoherald`
- Primary files read:
  - `src/components/landing-live.tsx` — hero, the amber "saved folder" section,
    the GET `/search` form, the "Send us what you saved" card
  - `src/components/landing/landing-v2.css` — the real design tokens
  - `src/app/identify/page.tsx` — the identify panel, the five-rung copy, the
    three measured figures
  - `src/app/identify/identify-form.tsx` — candidate rows and GitHub verdicts
  - `src/lib/resolve-repo.ts` — the ladder and the two guards
  - `README.md`
- Product name: repoherald
- Tagline / strongest claim: **"You already found it. Find it again."** (the
  landing page's actual `<h1>`)
- Key UI moments to recreate, in order of importance:
  1. The identify result row — a mono repository name with GitHub's verdict
     attached. This is the only place in the product where the model's proposal
     and the authority that checked it sit on one line.
  2. The landing page's search control, with its real placeholder, being typed
     into and returning one card.
  3. A grid of saved-post tiles with no titles on them — the problem, stated
     visually in the first frame.

### Copy that must appear verbatim
From the product; do not reword:
- `You already found it.`
- `Find it again.`
- `rust, scraper, that 3D thing…`  (the real `/search` placeholder)
- `In a private list only you can open.`
- `repoherald.com`

### Figures and names that must be exact
These are measured or verified. Do not round, restyle or invent neighbours:
- `24.6%` — label: `found automatically before`
- `89.9%` — label: `with Nemotron on Nebius Token Factory`
- `ErTasselli/OpenTerminal` — a verified case from this project's own eval,
  resolved through the narration path in one model call
- `"... ertasselli slash openterminal ..."` — its Whisper transcript
- `narration · Whisper` — the chip label
- `✓ GitHub confirmed it`

### Fabrication boundary — treat as a hard constraint
- No real user names, handles, avatars or profile pictures.
- No third-party logos or recreations of any platform's interface. Scene 2's DM
  is a **generic message bubble** — no platform chrome, no branding.
- Do **not** add a rejected (`✗`) candidate row. The verified run for this case
  had no rejected candidate; inventing one would misstate the measurement. The
  discipline is conveyed by the verdict chip on the row that did resolve.
- Do not invent extra repository names, star counts, user counts or timings.

## Creative Direction
- Tone preset: **polished**
- Creative direction: the quiet relief of finding something you had lost
- Interpretation: restrained motion, one statement at a time, no whips, no
  zooms, no parallax. Pace comes from clean cuts and from things *arriving*, not
  from text being pulled away before it can be read. The product's written voice
  is plain and slightly dry — "Your saved folder is full of repos you never
  opened" — so match that register. Nothing here is a joke, so nothing winks.
- Angle: The video is a rescue, not a feature tour. It opens inside the problem —
  a grid of saved posts with nothing readable on any of them — and ends with one
  of them back, found by typing a word. The hackathon content earns its place by
  being the hard part of the rescue: the one question between a saved post and a
  repository is "which repository is this?", and the product's own landing page
  admitted that was a person. Showing the model repair a spoken name is showing
  the bottleneck being removed.
- Hook: a grid of unlabelled saved tiles filling the frame, then the product's
  own hero line held still over it — `You already found it.` / `Find it again.`
- Outro / punchline: the two measured figures, then the wordmark. The punchline
  is that the rescue is only offerable at all because the first number moved.
- Avoid:
  - Generic SaaS language ("streamline", "supercharge", "AI-powered")
  - Abstract filler visuals, particle fields, gradient washes
  - Any visual redesign of the product — use its real tokens
  - Celebratory treatment of `89.9%`; it is a measurement, not a win

## Visual Identity
From `src/components/landing/landing-v2.css`, `.rhl[data-theme="dark"]` — the
product's real tokens.
- Background: `#0a0a0a`
- Surface / card: `#141413`
- Chip: `#1c1c1a`
- Text: `#f5f5f4`
- Muted text: `#9c9c97`
- Accent: `#e8ad46` (amber)
- Hairline: `rgba(255, 255, 255, 0.13)`
- Display + body font: Inter
- Mono font: JetBrains Mono — every repository name, transcript, verdict and
  chip on screen is mono, as the product renders them
- Visual references from the project: bordered `#141413` cards with 10px radius
  (`--radius: 0.625rem`); mono chips on `#1c1c1a`; the black-on-light / light-on-
  dark `Search` button; the shield glyph beside the wordmark in the footer

## Storyboard
`brag-output-2026-10-29-093543/brag-plan.md` is the creative contract — scene
descriptions, per-scene audio intent and the per-line reading floors are all
there. Scene summary:

1. **The saved folder** — 4.0s — 12 title-less saved tiles build fast into
   noise; then `You already found it.` (≥1.2s settled), then `Find it again.`
   in amber (≥1.2s).
2. **Send it instead** — 3.0s — one tile leaves the grid and becomes a sent
   generic DM bubble; `no caption. the name is only spoken.` (≥2.1s) and
   `One DM.`
3. **Which repository is this?** — 5.0s — the identify panel: chip
   `narration · Whisper`, the transcript typed in mono, then
   **The slash was spoken. The hyphens never were.** (≥2.4s), then the resolved
   row `ErTasselli/OpenTerminal` with `✓ GitHub confirmed it` (≥2.0s).
4. **It comes back searchable** — 4.0s — the real search control, `terminal`
   typed character by character, one result card arriving;
   `In a private list only you can open.` (≥1.8s).
5. **The measurement, then the mark** — 5.0s — `24.6%` then `89.9%` in amber on
   alternate strong cues, then the wordmark and `repoherald.com`.

## Audio
- Audio role: sparse professional accents over a low bed — support, never drive
- Audio arc: the bed enters almost unnoticed under a folder filling with things
  you cannot read, stays out of the way while a transcript is typed and
  repaired, gives the GitHub verdict the single bright sound in the piece, and
  resolves into near-silence under the wordmark. The loudest moment in the video
  is a repository being confirmed.
- Music: `assets/music/happy-beats-business-moves-vol-10-by-ende-dot-app.mp3`
  (109.96 BPM, 60.00s — the slowest bundled track, which suits the register)
- Music treatment: start at 0:00, low under Scene 1, modest through the middle,
  resolve and fade out across the final ~1.5s so the wordmark lands near-silent.
  No riser, no stinger.
- Music cue guidance: bundled preset at
  `/Users/shubhamarundekatey/.claude/skills/brag/assets/music/cues/happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json`.
  Strong cues to target: **15.82s** (`24.6%`), **18.01s** (`89.9%`), **20.19s**
  (wordmark settling). Beat grid is ~0.55s apart. Scene 5's two figures must use
  **alternate** strong cues so each clears its reading floor — do not put them
  on consecutive beats. Scene 1's 12-tile build may run sub-beat because no tile
  carries text.
- Audio-reactive treatment: **subtle**. The amber accent may gain a little
  presence on Scene 5's two strong cues. No waveform bars, no equalizer, no
  pulsing on text, no particles.
- Audio-coupled moments:
  - Scene 1, tile grid building — quiet tick texture, de-emphasised hard after
    the first three so it reads as one sound and not twelve
  - Scene 2, the DM sending — one soft short cue; the sound of a thing leaving
  - Scene 3, the transcript — dry key ticks under typed mono text
  - Scene 3, the verdict landing — one clean confirm; the brightest sound in the
    video and the only one allowed to feel like a result
  - Scene 4, `terminal` being typed — key ticks per character
  - Scene 4, the result card arriving — soft settle, on a beat
  - Scene 5, each figure landing on its strong cue
- SFX selection guidance: roughly six cues in twenty-one seconds. Match motion,
  never decorate. Keyboard files for typed text; a soft interface drop/switch
  for the card and bubble; one restrained confirm for the verdict. If a cue
  would make this feel like an ad, drop it.
- SFX analysis guidance:
  `/Users/shubhamarundekatey/.claude/skills/brag/assets/sfx/sfx-analysis.md` —
  prefer low high-frequency-risk files, especially for the repeated key ticks.
- Exact SFX choice: Hyperframes chooses filenames, timestamps, density and
  volume after the visual animation exists.
- Restraint rule: no riser, no whoosh on a cut, no stinger on the wordmark,
  nothing celebratory on `89.9%`.
- Audio files: music is already at
  `brag-output-2026-10-29-093543/composition/assets/music/`. Copy any selected
  SFX into the same `assets/` tree.

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills and prefer native
Hyperframes conventions over anything in `/brag`. This is the `/brag` workflow:
do not enter the `hyperframes` entry-point intent interview and do not route
into its generic promo / launch-video workflow.

Requirements:
- Show real UI, copy and tokens from the project — the identify row, the search
  control and the hero line are all real.
- Keep every line readable: the per-line settled minimums in the storyboard are
  floors, not suggestions. Fast-in then hold.
- Total duration 21s.
- Include the music and SFX layer.
- Treat `/brag` audio notes as guidance; choose SFX after the animation exists.
- Lock 2–3 major reveals to strong cues within ±0.15s and mark them
  `// beat-locked`. Snap sequential non-text accents to `beats[]` within ±0.10s
  and mark them `// beat-grid`. Readability wins over any cue.
- Wire at least one existing visual element to the audio data, subtly, or
  document the extraction failure.
- Use local assets only.
- Run `hyperframes check` before render — it is brag's single gate.
