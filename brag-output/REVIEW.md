# Review — repoherald brag

Checked: `npx hyperframes check` → 0 errors, 0 warnings across lint, runtime,
layout, motion, contrast (16/16 WCAG AA) and craft.

## Two defects found by looking at frames, not by the gate

Both passed `check` and still would have shipped badly.

1. **Dead black after the cut to Scene 3.** The first counter was beat-locked to
   the 12.65s strong cue, but the scene cuts in at 12.0s, so the review sheet at
   12.3s was an empty frame. Fixed by making row 1 present at scene start and
   moving rows 2 and 3 to grid beats at 14.22 / 16.34s. The strong-cue lock moved
   to card 2 at 6.34s, where it costs nothing. Readability over the grid.

2. **The bed was inaudible.** First render measured -28.4 LUFS. `sound.md` targets
   -16 to -14 for social, and a bed nobody hears is a failed bed. Music 0.22 →
   0.58 and SFX 0.5 → 0.68 brought it to -21.2 LUFS at -1.6 dBTP true peak.

## Audio, measured not heard

```
25.000 s  music (0.9 confidence)
onset 0.535   peak 14.222   tail end 18.519
silent 18.500–25.000
loudness -21.2 LUFS, true peak -1.6 dBTP
```

- The silence from 18.5s is deliberate: the closing line lands dry.
- Peak at 14.222s is the second counter tick, landing with its picture.
- -21.2 LUFS sits under the -16/-14 social target. With true peak already at
  -1.6 dBTP there is ~0.6 dB of headroom left, so this mix cannot go much louder
  without limiting, and a quarter of the film is intentionally silent, which
  drags the integrated figure down. Documented rather than forced.

## Poster

Pulled at 17.5s (all three counters settled) and baked as frame 0: frame 0 is
49,162 bytes against the poster's 50,313, where the 1.0s hook frame is 37,357 —
so the thumbnail grabbers get the counters, not the intro.
