# Brag Plan: repoherald — "You already found it. Find it again."

> Reframe run. The previous `brag-output/` video bragged about what the mobile
> app *omits*. This one brags about the thing the product is actually for:
> getting back a repository you saved somewhere and lost. Per
> `[[repoherald-positioning]]`, the star→credit loop is the minimal-impact
> mechanic and must not lead.

## What is this app?
You find a developer tool on social media, save the post, and lose it — a
folder of unlabelled thumbnails with no titles, no notes and no search.
repoherald takes the post instead: it works out which GitHub repository the
post was about, catalogues it, and files it in a private list you can finally
search. The step in the middle used to be a person reading captions by hand;
it now runs on NVIDIA Nemotron on Nebius Token Factory.

## The angle
The video is a rescue, not a feature tour. It opens inside the problem — a grid
of saved posts with nothing readable on any of them — and ends with one of them
back, found by typing a word. The hackathon content earns its place by being
*the hard part of the rescue*, not a bolt-on: the one question between a saved
post and a repository is "which repository is this?", and the product's own
landing page admitted that was a person. Showing the model repair a Whisper
transcript is showing the bottleneck being removed.

Specific to this project and no other: the inputs are real failure shapes from
this product's corpus (a name that was only *spoken*, so the slash is a word and
the hyphens are silent), and both figures on screen are measured, not claimed.

## Hook (first 2-3 seconds)
A grid of saved-post tiles builds fast and anonymous — no titles, no captions,
just thumbnails and bookmark glyphs, until the frame is noise. Then the
product's own hero line, held still over it:

    You already found it.

then, in amber:

    Find it again.

The hook is recognition. Anyone who saves more than they read has this folder
on their phone, and the first frame *is* that folder.

## Key moments (the middle)
- **One tile leaves the grid and becomes a sent DM.** The reel has no caption at
  all — the label says `no caption. the name is only spoken.` That is the
  hardest real input this product takes, and it sets up the next scene.
- **The identify panel doing the repair.** A Whisper transcript reading
  `"... ertasselli slash openterminal ..."` resolves to
  `ErTasselli/OpenTerminal`, with GitHub's confirmation on the row. The line
  that explains it is the honest one: *the slash was spoken, the hyphens never
  were.*
- **The search box, working.** The payoff is unglamorous on purpose: type
  `terminal`, the repository comes back as a card in a private list. That is the
  whole promise of the product in one gesture.

## Outro / punchline
Two measured figures, the second one amber:

    24.6%   found automatically before
    89.9%   with Nemotron on Nebius Token Factory

Then the wordmark and `repoherald.com`. The punchline is that the rescue is only
offerable at all because that first number moved.

## User flow worth showing
Real, three beats, all three in the shipped product:
1. **Entry** — DM a saved post instead of saving it again (landing: "Send us
   what you saved").
2. **Key action** — identification: caption, on-screen text or narration in,
   a GitHub repository out (`/identify`, `src/lib/resolve-repo.ts`).
3. **Result** — it lands in a private list and is searchable (the landing page's
   own GET `/search` form, placeholder `rust, scraper, that 3D thing…`).

Scenes 2, 3 and 4 are these three beats in order. Scenes 1 and 5 frame them.

## Tone
- Preset: polished
- Creative direction: the quiet relief of finding something you had lost
- Interpretation: restrained motion, one statement at a time, no whips or
  zooms. Pace comes from clean cuts and from things *arriving*, not from text
  being yanked away. The product's written voice is plain and slightly dry
  ("Your saved folder is full of repos you never opened"), so the video borrows
  that register instead of inventing an excited one. Nothing here is a joke, so
  nothing winks.

## Format: landscape — 1920x1080
## Duration: 21.7s as rendered (21s planned)

## Visual identity (from the project)
Taken from `src/components/landing/landing-v2.css`, dark theme
(`.rhl[data-theme="dark"]`) — the product's real tokens, not approximations.
- Background: `#0a0a0a`
- Surface / card: `#141413`
- Chip: `#1c1c1a`
- Text: `#f5f5f4`
- Muted text: `#9c9c97`
- Accent: `#e8ad46` (amber)
- Hairline: `rgba(255, 255, 255, 0.13)`
- Display + body font: Inter (`--font-inter`, loaded by `next/font/google`)
- Mono font: JetBrains Mono (`--font-jbmono`) — used for every repository name,
  transcript and verdict on screen, as the product does
- Strongest visual element: the identify result row — a mono repository name
  with GitHub's verdict attached to it. It is the only place in the product
  where the model's proposal and the authority that checked it sit on one line.

## Fabrication boundary
Nothing invented. `ErTasselli/OpenTerminal` and the transcript
`"ertasselli slash openterminal"` are a verified case from this project's own
eval (resolved via the narration path, `foundIn: narration`, one model call).
`24.6%` and `89.9%` are the measured baseline and post-guard figures over 228
cases. No real user names, handles, avatars or third-party logos appear; the DM
is a generic message bubble, not a recreation of any platform's interface. No
candidate row is shown as *rejected*, because the verified run for this case
had no rejected candidate and inventing one would misstate the measurement.

## Share copy (draft)
Your saved folder is full of repos you never opened. Send one instead — NVIDIA
Nemotron on Nebius Token Factory works out which repository the post was about,
and it comes back as something you can search. 24.6% → 89.9%.

## Audio direction
- Role: sparse professional accents over a low bed — support, never drive
- Music: `happy-beats-business-moves-vol-10-by-ende-dot-app.mp3` (109.96 BPM,
  60.00s — the slowest bundled track, which suits a polished register)
- Music treatment: start at 0:00, enter under the grid build at low volume,
  hold modest through the middle, resolve and fade out across the last 1.5s so
  the wordmark lands in near-silence
- Music cue guidance: preset read from
  `assets/music/cues/happy-beats-business-moves-vol-10-...music-cues.json`.
  Strong cues to target: **15.82s** (the `24.6%` figure), **18.01s** (the
  `89.9%` figure), **20.19s** (the wordmark settling). Beat grid for sequential
  reveals runs ~0.55s apart; the 12-tile grid build in Scene 1 may run at a
  sub-beat rate because no tile carries text, and the stat pair in Scene 5
  must use every *other* strong cue so each figure clears its reading floor.
- Audio-reactive treatment: subtle. The amber accent may gain a little presence
  on the two strong cues in Scene 5. No waveform bars, no pulsing on text.
- SFX posture: sparse. Roughly six cues in twenty-one seconds.
- Audio-coupled moments: the tile grid building (a quiet tick texture, read as
  one sound and not twelve); the DM bubble sending; the transcript appearing in
  mono; the GitHub verdict landing on the resolved row (one clean confirm, the
  only bright sound in the video); the word `terminal` being typed; the result
  card arriving.
- Restraint rule: no riser, no whoosh on a cut, no stinger on the wordmark, and
  nothing celebratory on the `89.9%`. The figure is a measurement and should
  sound like one. If a cue would make the video feel like an ad, drop it.

## Storyboard

### Scene 1 — The saved folder — 4.0s
A 4×3 grid of saved-post tiles on `#0a0a0a`: each a `#141413` card with a
rounded thumbnail block, a small bookmark glyph, and deliberately **no title**.
One or two carry a play triangle. The grid fills the frame and reads as noise —
that is the point. At ~1.4s a scrim drops over it and the hero line lands
centred in Inter, large: **You already found it.** (settled ≥1.2s). At ~2.8s it
swaps for **Find it again.** in `#e8ad46`, same position (settled ≥1.2s).
Sequential/interaction: yes — 12 tiles arrive one by one, ~0.06s apart, fast
enough to read as a single fill rather than twelve events. No tile carries text,
so the reading floor does not apply to them.
Audio intent: the bed enters almost unnoticed; the ticks should feel like a
folder loading, not like an animation.
Audio-coupled idea: quiet tick texture on the tile arrivals, heavily
de-emphasised after the first three.
Music: low, entering.
Transition mood: soft crossfade → Scene 2

### Scene 2 — Send it instead — 3.0s
One tile lifts out of the grid; the rest fall away. It becomes a sent message
bubble — a generic DM row, no platform chrome, no name, no avatar — carrying the
reel thumbnail and a `Sent` tick. Under it, mono and muted:
`no caption. the name is only spoken.` (settled ≥2.1s). Bottom-left, mono:
`One DM.`
Sequential/interaction: yes — simulate the send: the bubble rises into the
thread and the tick appears after it settles.
Audio intent: one soft, short send — the sound of a thing leaving, not arriving.
Audio-coupled idea: the send motion; the tick.
Music: low, steady.
Transition mood: clean cut → Scene 3

### Scene 3 — Which repository is this? — 5.0s
The identify panel, recreated from `/identify`. A bordered `#141413` card.
Top row, a chip in mono: `narration · Whisper`. Below it the input, mono and
muted, with a typed feel: `"... ertasselli slash openterminal ..."`. Then the
explanation in Inter, `#f5f5f4`: **The slash was spoken. The hyphens never
were.** (settled ≥2.4s). Then the resolved row arrives in the lower third:
`ErTasselli/OpenTerminal` in mono, with a verdict chip beside it reading
`✓ GitHub confirmed it` — the check in a restrained green, the only non-amber
colour in the video (settled ≥2.0s, may overlap the tail of the line above it
since it occupies a different region).
Sequential/interaction: yes — four arrivals in order: chip, transcript,
explanation, resolved row. The transcript should appear as typed text, not as a
block fade.
Audio intent: this is the scene that has to feel like work being done. Dry key
ticks under the transcript, then one clean confirm on the verdict — the brightest
sound in the piece, and the only one that is allowed to feel like a result.
Audio-coupled idea: typed transcript with key ticks; a single confirm tone on
the `✓`, placed on a beat.
Music: holds, slightly fuller.
Transition mood: clean cut → Scene 4

### Scene 4 — It comes back searchable — 4.0s
The landing page's real search control: a bordered input with the product's own
placeholder `rust, scraper, that 3D thing…` and a `Search` button in
`#f5f5f4`/`#0a0a0a`. A cursor types `terminal` character by character. One
result card slides in below: `ErTasselli/OpenTerminal` in mono, a language chip,
and a muted second line standing in for the kept note. Bottom, Inter, muted:
`In a private list only you can open.` (settled ≥1.8s).
Sequential/interaction: yes — typing, then one card arriving. One card, not
three: the promise is finding *the* thing, not browsing.
Audio intent: relief. Keystrokes, then a soft settle — the sound of a search
that worked first time.
Audio-coupled idea: key ticks on each typed character; a soft arrival on the
card, on a beat.
Music: holds.
Transition mood: soft crossfade → Scene 5

### Scene 5 — The measurement, then the mark — 5.0s
Two figures, large, tabular, arriving one then the other on strong cues:
`24.6%` in `#f5f5f4` with `found automatically before` beneath it in muted
Inter; then `89.9%` in `#e8ad46` with `with Nemotron on Nebius Token Factory`
beneath it (each figure settled ≥0.8s, each label ≥0.9s / ≥1.8s). At ~3.4s both
clear and the wordmark takes the frame: the shield glyph and **repoherald**,
letterspaced as the product renders it, with `repoherald.com` in mono beneath
(settled ≥1.2s).
Sequential/interaction: yes — the two stat blocks arrive on *alternate* strong
cues (~15.82s and ~18.01s on the track), never on consecutive beats, so each
clears its reading floor.
Audio intent: a measurement being stated, not a win being celebrated. The second
figure gets presence, not a stinger.
Audio-coupled idea: each figure landing on its strong cue; the music resolving
under the wordmark and fading to near-silence.
Music: resolves, then fades out across the final ~1.5s.
Transition mood: — (end)

**Music mood for this video:** restrained upbeat, held back — a low bed under a
polished product film, not a launch ad.
**Audio summary:** The bed enters almost unnoticed under a folder filling with
things you cannot read, stays out of the way while a transcript is typed and
repaired, gives the GitHub verdict the single bright sound in the piece, and
resolves into near-silence under the wordmark — so the loudest moment in
twenty-one seconds is a repository being confirmed, which is the moment the
product exists for.

## Scene duration check — as planned, then as shipped

Planned: 4.0 + 3.0 + 5.0 + 4.0 + 5.0 = 21.0s.

Shipped: **4.2 + 2.9 + 5.45 + 3.274 + 6.1 = 21.7s** (scene 5 overlaps scene 4
by 0.224s for the dissolve, so the hosts sum past the runtime). Two things
moved it:

- the beat locks. Fitting the result card, the first figure and the second
  figure to strong cues at 13.642 / 15.824 / 18.007 set the scene 3–4 and 4–5
  boundaries, which is why scene 4 is 3.274s rather than a round 4.
- the closing line. `check` measured the wordmark at 1.36s against the 2.00s a
  film's last line needs. The mark lands on the 19.644s bar, so the fix was to
  let the film run to 21.7s rather than drag the mark off the beat.

Still inside the 15–25s law.
