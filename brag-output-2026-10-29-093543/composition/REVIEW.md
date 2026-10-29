# Review — repoherald, "You already found it. Find it again."

21.7s · 1920×1080 · 30fps · 651 frames · 991 KB · rendered 29 Oct 2026.
Output: `../brag.mp4`, poster `../brag.jpg` (baked as frame 0).

## The creative call, and the one I did not build

The film is a **rescue, not a feature tour**. It opens inside the problem — a
folder of saved posts with nothing readable on any of them — and ends with one
of them back, found by typing a word. The hackathon content (Nemotron on Nebius
Token Factory) earns its place by being the hard part of that rescue rather than
a capability demo bolted to the end: scene 3 is the bottleneck being removed,
and the two figures in scene 5 are what removing it was worth.

**The storyline I did not build:** the model-first cut — open on the five-rung
ladder, show the tier split, close on the product. It is the stronger film for a
judge who already knows what repoherald is, and the weaker one for everybody
else, because a ladder is uninteresting until you care about the folder. The
project's own positioning note says the saved-folder rescue leads and the
star/credit loop is secondary; this cut follows that, and the star/credit
mechanic appears nowhere in the 21.7s.

## What I measured, what I looked at, what nobody checked

**Measured:**
- `check` — clean. Zero errors, zero warnings across lint, runtime, layout,
  motion, contrast, craft and audio.
- Audio of the rendered file, via `hyperframes audio`: **−16.4 LUFS
  integrated**, **−1.6 dBTP** true peak, **0 clipping samples**, no silence
  gaps. Inside the −16…−14 social band and under the −1 dBTP ceiling.
- Every placed SFX registers as an onset in the rendered file: send 4.23,
  verdict 11.44, card 13.625, stat-1 15.805, stat-2 17.99. None is a silent
  element that only exists in the markup.
- Frame 0 against the poster, pixel-wise: 0.35% of channels differ by more than
  6/255, which is H.264/JPEG recompression and not a different frame. The bake
  held, and duration, frame count and the audio stream survived it (651 frames,
  21.7s, AAC).

**Looked at:** the beat sheet, all five seam strips, and the 360px phone sheet.
Every line meant to be read is legible at phone width, including the 32px chip
and the mono transcript.

**Nobody checked:** *the sound was measured, not heard.* I have numbers for
loudness, peak, clipping and hit placement, and no judgement at all about
whether the bed suits the film or whether six cues in 21.7s feels sparse or
right. The first person to play it should listen for that specifically.

## Timing discipline

Every line clears its reading floor (0.5s + 0.3s per word), checked per line
rather than per scene:

| Line | Settled | Floor |
|---|---|---|
| `For everyone who saves more than they read` | 0 → 2.70s | 2.4s |
| `You already found it.` | 1.55 → 2.78s | 1.2s |
| `Find it again.` | 3.13 → 4.10s | 0.9s |
| `no caption. the name is only spoken.` | 4.80 → 7.10s | 2.1s |
| `The slash was spoken. The hyphens never were.` | 9.36 → 12.39s | 2.4s |
| `✓ GitHub confirmed it` | 11.459 → 12.39s | 0.9s |
| `In a private list only you can open.` | 13.13 → 15.70s | 2.4s |
| `with Nemotron on Nebius Token Factory` | 18.007 → 21.7s | 1.8s |
| `repoherald` / `repoherald.com` | 19.644 → 21.7s | 2.0s |

Beat locks against the track's own cue preset (109.96 BPM):
- **13.642s** — the search result arriving (strong beat, 0.895)
- **15.824s** — `24.6%` (strong beat, 0.957)
- **18.007s** — `89.9%` (strong beat, 0.966) — deliberately the next strong cue
  *but one*, 2.18s after the first figure, so the first label clears its floor
  before the second arrives
- **11.459s** — the GitHub verdict (onset peak, 0.941), the strongest cue in the
  middle of the track

Beat grid: the folder starts filling on the track's first beat (0.267s) and the
resolved row arrives on 9.834s. Transitions are four kinds, each with a cause on
screen — dip cut (4.1s), object-becomes-the-world (6.82s), blur swap on one
stage (12.39s), ground dissolve (15.6s).

## The weakest shot

**7.4s — scene 3's opening.** For about 0.3s the frame is an empty bordered
card while the panel scales in and before the chip arrives. It reads as a panel
opening rather than as a mistake, and the review tool samples scene-start frames
so a build frame is expected there — but it is the one frame in the film that is
not postable on its own. With more time I would move the chip from local 0.30 to
0.18 and the transcript from 0.50 to 0.42, which costs a re-render and shifts
four keyboard SFX by 80ms for a 0.12s gain. I judged that not worth a render.

**Second weakest: 4.5s**, scene 2's opening — the bubble alone in a large frame
for 0.3s before the note arrives. Same shape of problem, shorter.

## Warnings kept on purpose

- **`#se2-ph` carries `data-layout-ignore`.** The search placeholder
  `rust, scraper, that 3D thing…` is on screen 0.55s against a 2.0s floor.
  It is the field's resting state, not a line carrying the argument, and it is
  replaced by the thing that matters — so it is marked as texture rather than
  padded out to 2s, which would have pushed the beat-locked result card off its
  cue. I did lengthen it from the 0.27s it had on the first pass.
- **`#fo-grid` carries `data-layout-ignore`** — twelve decorative tiles with no
  text, audited as one block via the scrim instead.
- Nothing else is silenced. There is no contrast escape hatch in use.

## Fabrication boundary — what is real

Worth re-reading before any edit, because the obvious "improvements" break it:

- `ErTasselli/OpenTerminal` and the transcript `"... ertasselli slash
  openterminal ..."` are a **verified case from this project's own eval**,
  resolved through the narration path in one model call.
- `24.6%` and `89.9%` are the measured baseline and post-guard figures over 228
  cases.
- **There is deliberately no rejected (`✗`) candidate row**, although it would
  dramatise "the model proposes, GitHub decides" better. The verified run for
  this case had no rejected candidate, and inventing one would misstate the
  measurement. The discipline is carried by splitting the row's arrival (9.834s,
  name muted — proposed) from the verdict (11.459s, name brightens — confirmed)
  instead.
- No real user names, handles or avatars. Scene 2's DM is a generic bubble with
  no platform chrome, by design.
- The palette and radius are read from `src/components/landing/landing-v2.css`
  (`.rhl[data-theme="dark"]`), not approximated.

## Audio-reactive

Subtle, and driven from the **bundled cue preset** rather than a per-frame RMS
extraction: no extraction helper is installed in this environment, so the cue
preset is the audio data available. The two intensities (0.957, 0.966) move
brightness on `24.6%` and a short amber glow on `89.9%`, both decaying within
0.8s. Driving it from constants also keeps every frame renderable on its own,
which a per-frame audio read would not. No bars, no equalizer, no pulsing text.

One claim in `brag-plan.md` did not survive measurement: it says the GitHub
verdict is "the brightest sound in the piece". Measured, the verdict onset reads
0.52 and the `89.9%` onset reads 1.00 — because the second figure sits on the
track's own strongest beat, so the music is doing that. Raising the verdict
further would put true peak over −1 dBTP. The payoff being the loudest moment is
the right outcome; the plan's sentence was just optimistic.
