# Handoff: repoherald — Landing Page

## Overview
A single-page marketing/landing site for **repoherald** (always lowercase) — a portal
where developers and companies post their GitHub repos to be discovered and starred,
and where *verified* stars earn "highlight time" near the top of the feed. Sponsorship
is offered transparently (always labeled, never disguised).

The page includes: nav, hero with a live stat row, a three-step "how it works" section,
a feed preview of three repo cards, a minimal footer, and a dismissible **sponsorship
panel** (the key interactive element). Full light + dark themes.

Tagline: **"Star what deserves to be seen."**

## About the Design Files
The files in this bundle are a **design reference created in HTML** — a working
prototype showing the intended look and behavior. It is **not production code to copy
directly**. `repoherald.dc.html` is a "Design Component" format (a custom streaming-
HTML authoring format); treat it as a spec, not a source file to import.

Your task is to **recreate this design in the target codebase's environment** (React,
Next.js, Vue, etc.) using its established patterns, component library, and styling
approach. If no codebase exists yet, choose an appropriate stack (Next.js + Tailwind is
a good default for this kind of marketing page) and implement it there.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, and interactions are final.
Recreate the UI pixel-accurately using the target codebase's libraries. All exact
values are in the **Design Tokens** section below.

---

## Layout Fundamentals
- **Centered column**, `max-width: 1100px`, horizontal padding `32px` (desktop) →
  `22px` (mobile ≤720px).
- Vertical rhythm between major sections separated by **1px hairline rules**
  (`--hair`), several of them also constrained to the 1100px column.
- Base font: **Inter**. Monospace accents: **JetBrains Mono** (repo names, stat row,
  step numbers, plan durations, small captions).
- Root has `transition: background .25s, color .25s` for theme switching and
  `overflow-x: hidden`.

## Screens / Views
This is one continuous page. Sections top → bottom:

### 1. Nav
- **Layout**: flex row, space-between, `padding: 22px 32px`, vertical-centered,
  `gap: 24px`. Followed by a full-width 1px hairline.
- **Left — wordmark**: shield icon (`height: 26px`) + text "repoherald"
  (Inter 600, 17px, letter-spacing -0.2px, color `--fg`), `gap: 10px`.
  The shield image source swaps by theme (black asset in light, white asset in dark).
- **Center-right links** (`.rh-navlinks`, hidden ≤720px): "Explore", "Post a repo",
  "Sponsor" — Inter 500, 14px, color `--muted`, `gap: 26px`, `margin-left: auto`.
  Hover → color `--fg`. **"Sponsor" is a `<button>`** that opens the sponsorship panel.
- **Theme toggle** (`.rh-themebtn`, hidden ≤720px): 34×34px, 1px border `--hair`,
  radius 8px, background `--card`. Glyph `☾` in light / `☀` in dark.
  `aria-label="Toggle dark mode"`. Hover bg `--chip`.
- **Primary CTA** — "Sign in with GitHub": Inter 600, 14px, padding `9px 15px`,
  radius 9px, solid `--btnbg` bg / `--btnfg` text. Leading `⌥` glyph stands in for the
  GitHub mark (**replace with a real GitHub icon** in production). Hover `opacity .88`.
  This is the **only** CTA styled as a filled button in the nav.

### 2. Hero
- **Layout**: centered text, `padding: 96px 32px 84px`.
- **Eyebrow pill**: inline-flex, JetBrains Mono 12px, 1px border `--hair`, radius 999px,
  padding `5px 13px`, `margin-bottom: 30px`. Content: amber `★` + "Star what deserves
  to be seen."
- **H1** (`.rh-h1`): Inter 700, **60px** (→ 36px ≤720px), line-height 1.03,
  letter-spacing -1.8px, max-width 780px, `text-wrap: balance`.
  Copy: **"Where good repos get found."**
- **Sub**: Inter 19px, line-height 1.55, color `--muted`, max-width 560px, `margin-top 22px`.
  Copy: "Post your work, let developers star what deserves attention, and turn verified
  stars into highlight time on the feed."
- **CTA row** (`.rh-cta`, stacks + stretches ≤720px): `gap 12px`, `margin-top 38px`.
  - Primary "Sign in with GitHub": filled, Inter 600 15px, padding `13px 22px`, radius 11px.
  - Ghost "Browse repos": transparent, 1px border `--ghost`, color `--fg`, same size.
    Hover bg `--chip`. Anchors to `#feed`.
- **Stat row** (`.rh-stats`, wraps ≤720px): JetBrains Mono 13px, color `--muted`,
  `gap 22px`, `margin-top 50px`. Dot-separated:
  `◈ 1,204 repos · ★ 38,510 stars claimed · 3,412 users`
  (the `◈` and `★` glyphs are colored `--accent`; the `·` separators are `opacity .4`).

### 3. How it works
- **Header label**: JetBrains Mono 12px, uppercase, letter-spacing .08em, `--muted`,
  `margin-bottom 40px`. Text "How it works".
- **Steps grid** (`.rh-steps`): `grid-template-columns: 1fr 1fr 1fr`, `gap 0`
  (stacks to 1 column ≤720px). Columns 2 & 3 have `border-left: 1px solid --hair`;
  on mobile the left borders become top borders between stacked steps.
- Each step: mono index in amber (`◇ 01`, `★ 02`, `◈ 03`, 13px, `margin-bottom 16px`),
  an Inter 600 19px title, and an Inter 15px `--muted` sentence (`line-height 1.55`).
  1. **Post your repo** — "Connect GitHub and list any public repository in under a minute."
  2. **Star & verify** — "Real developers star what they value; each star is verified against GitHub."
  3. **Earn highlight time** — "Verified stars translate into time featured near the top of the feed."
- No cards — just rhythm and hairline dividers.

### 4. Feed preview  (`id="feed"`)
- **Header row**: mono uppercase label "The feed" (like §3) on the left; "View all →"
  link (Inter 500 13px, `--muted`) on the right. `margin-bottom 26px`.
- **Card list**: flex column, `gap 12px`. Each card is an `<article>`:
  flex row, `align-items: flex-start`, `gap 16px`, `padding 20px`, radius 14px,
  background `--card`. Hover → `transform: translateY(-2px)` (transition .15s).
  - **Avatar**: 44×44px, radius 10px, bg `--chip`, centered JetBrains Mono 600 16px
    initial in `--chipfg`.
  - **Body** (flex 1, min-width 0): title row (mono 600 15px `owner/repo` + optional
    badge, `gap 10px`, wraps) → description (Inter 14px, `--muted`, `margin 8px 0 12px`)
    → chip row (`gap 8px`). Each chip: JetBrains Mono 12px 500, `--chipfg` on `--chip`,
    radius 6px, padding `3px 9px`.
  - **Star count** (right, flex 0 0 auto): mono 600 14px, amber `★` + value.
- **Three cards**:
  1. **`tanstack/query`** — border is **`2px solid --sponsor` (strong red)**.
     Carries a **"Sponsored"** tag: mono 10px 600, uppercase, letter-spacing .06em,
     color `--sponsor`, 1px `--sponsor` border, radius 5px, padding `2px 7px`.
     Desc: "Type-safe data fetching, caching & sync for TypeScript apps."
     Chips: TypeScript, Data. Stars: 41.2k. Avatar "T".
  2. **`astral-sh/uv`** — normal 1px `--hair` border. Carries the amber **"Highlighted"**
     badge: inline-flex amber `★` + label, mono 10px 600 uppercase, color `--accent-ink`
     on `--accent-soft` bg, radius 5px, padding `2px 7px`.
     Desc: "An extremely fast Python package & project manager, written in Rust."
     Chips: Python, Tooling. Stars: 28.7k. Avatar "A".
  3. **`zed-industries/zed`** — normal 1px `--hair` border, no badge.
     Desc: "A high-performance, multiplayer code editor built for speed."
     Chips: Rust, Editor. Stars: 51.4k. Avatar "Z".
  > Sponsorship is always labeled. The red-bordered "Sponsored" card and the amber
  > "Highlighted" badge are visually distinct and never disguised as organic results.

### 5. Footer
- `border-top: 1px solid --hair`. Inner row (`.rh-foot`, stacks ≤720px):
  flex space-between, `padding 30px 32px`, `gap 24px`.
- **Left — user-count pill**: inline-flex, mono 12px `--muted`, 1px `--hair` border,
  radius 999px, padding `5px 11px`. A 7px amber dot + "3,412 users".
- **Center — wordmark**: shield (18px, opacity .85) + "repoherald" (Inter 600 14px).
- **Right — links**: Inter 13px `--muted`, `gap 20px`: "Terms", "Privacy", "GitHub",
  and **"Sponsorships"** (a `<button>` that re-opens the sponsorship panel).

### 6. Sponsorship panel  (the key interactive element)
- **Role/label**: `<aside role="dialog" aria-label="Sponsorship offers">`.
- **Placement**: `position: fixed`, `right 20px`, `bottom 20px`, `z-index 50`,
  width/max-width **360px**. On mobile (≤720px) becomes a full-width bottom sheet:
  `left 12px; right 12px; bottom 12px; max-width:none; width:auto`.
  It must **not block the hero** — anchored bottom-right on desktop.
- **Container**: bg `--card`, 1px `--hair` border, radius 16px, padding 18px.
  Shadow `0 20px 50px rgba(0,0,0,.14)` (light) / `...,.6)` (dark).
- **Open/close animation**: `transition: transform .4s cubic-bezier(.22,1,.36,1),
  opacity .35s ease`. Open → `translateY(0)`, opacity 1, pointer-events auto.
  Closed → `translateY(140%)`, opacity 0, pointer-events none.
- **Header**: title "Sponsor a repo" (Inter 600 15px) + sub "Pin great work to the top
  of the feed." (Inter 12.5px `--muted`). **Close button** on the right: 28×28px,
  glyph `×` 18px, `aria-label="Close sponsorship offers"`, hover bg `--chip`.
- **Three plan rows**: each 1px `--hair` border, radius 11px, padding `13px 14px`,
  hover → `border-color: --accent`. Row = duration/star cap (mono 600 13.5px) +
  price (Inter 700 15px) on a baseline space-between line, then a one-line benefit
  (Inter 12.5px `--muted`):
  - **7 days · 75 stars — $49** — "Pinned to the top of the feed."
  - **15 days · 160 stars — $89** — "Featured slot plus category highlight."
  - **30 days · 350 stars — $149** — "Top placement for a full month."
- **Footer of panel**: full-width filled "Sponsor a repo" button (Inter 600 14px,
  padding 11px, radius 10px), then mono 11px `--muted` centered note:
  **"Ends whichever comes first — days or stars."**
- **Tone**: informative, not pushy. No countdown timers, no fake urgency.

## Interactions & Behavior
- **Theme toggle** (nav): flips light ↔ dark. Swaps every `var()` token AND the shield
  image source. Root transitions bg/color over .25s.
- **Sponsorship panel open/close**:
  - "Sponsor" (nav) and "Sponsorships" (footer) → **open**; write
    `localStorage['rh_sponsor_dismissed'] = '0'`.
  - Close "×" → **dismiss**; write `localStorage['rh_sponsor_dismissed'] = '1'`.
  - On load, panel is open **unless** `rh_sponsor_dismissed === '1'`. It stays closed
    across reloads once dismissed.
- **Card hover**: `translateY(-2px)`.
- **Plan row hover**: border turns amber.
- **Button hover**: filled buttons `opacity .88`; ghost/theme/toggle → bg `--chip`.

## Accessibility
- WCAG AA contrast maintained in both themes. Amber (`--accent`) is reserved for
  highlight/star moments; text on amber uses the darker `--accent-ink` for contrast.
- **Visible focus rings** on all interactive elements:
  `outline: 2px solid var(--accent); outline-offset: 2–3px` (via focus styles).
- Close button is keyboard-reachable with `aria-label="Close sponsorship offers"`.
- Panel is a `role="dialog"` with `aria-label="Sponsorship offers"`.
- Respects `prefers-reduced-motion: reduce` — disables all transitions/animations.
- Theme toggle has `aria-label="Toggle dark mode"`.

## Responsive Behavior (breakpoint: max-width 720px)
- Nav center links and theme toggle hidden → wordmark + "Sign in with GitHub" remain.
- Steps grid → single column; column dividers become top dividers.
- Sponsorship panel → full-width bottom sheet (12px insets).
- H1 → 36px, letter-spacing -1px.
- Section padding → 22px sides. CTA row stacks + stretches. Stat row + footer wrap/stack.
- Deliverable target sizes: **desktop 1440px**, **mobile 390px**.

## State Management
- `theme`: `'light' | 'dark'` — default `'light'`. Toggled by nav button.
- `panelOpen`: boolean — initialized from `localStorage['rh_sponsor_dismissed']`
  (open unless `'1'`). Set by Sponsor/Sponsorships (true) and Close (false).
- No data fetching in the prototype; the feed cards and stats are static mock content.
- In the prototype these are also exposed as tweakable props: `theme` (light/dark),
  `accentColor` (overrides `--accent`), `panelDefaultOpen` (boolean).

## Design Tokens

### Colors — Light
| Token | Value |
|---|---|
| `--bg` | `#fbfbfa` |
| `--fg` | `#0a0a0a` |
| `--muted` | `#6b6b68` |
| `--hair` | `rgba(0,0,0,0.10)` |
| `--card` | `#ffffff` |
| `--chip` | `#f3f3f1` |
| `--chipfg` | `#4b4b48` |
| `--accent` (amber) | `#a9720f` |
| `--accent-soft` (amber bg) | `#f8efdc` |
| `--accent-ink` (amber text) | `#7a520a` |
| `--sponsor` (red) | `#d21f1f` |
| `--btnbg` / `--btnfg` | `#0a0a0a` / `#ffffff` |
| `--ghost` (border) | `rgba(0,0,0,0.14)` |

### Colors — Dark
| Token | Value |
|---|---|
| `--bg` | `#0a0a0a` |
| `--fg` | `#f5f5f4` |
| `--muted` | `#9a9a97` |
| `--hair` | `rgba(255,255,255,0.12)` |
| `--card` | `#131313` |
| `--chip` | `#1e1e1e` |
| `--chipfg` | `#b5b5b2` |
| `--accent` (amber) | `#e6ad48` |
| `--accent-soft` (amber bg) | `#2a2012` |
| `--accent-ink` (amber text) | `#f0c069` |
| `--sponsor` (red) | `#f0544f` |
| `--btnbg` / `--btnfg` | `#f5f5f4` / `#0a0a0a` |
| `--ghost` (border) | `rgba(255,255,255,0.18)` |

### Typography
- **UI / body**: Inter — 400/500/600/700.
- **Mono accents**: JetBrains Mono — 400/500/600.
- Scale used: H1 60/36px (700, ls -1.8px); section labels 12px mono uppercase;
  hero sub 19px; body 14–15px; captions/notes 11–13px.

### Radii
- Buttons 9–11px · cards 14px · panel 16px · avatars/chips-inner 10px · chips 6px ·
  badges 5px · pills 999px.

### Spacing (key values)
- Container padding 32px (22px mobile) · nav padding `22px 32px` ·
  hero padding `96px 32px 84px` · section padding `72px 32px` · card padding 20px ·
  panel padding 18px · common gaps 8/10/12/16/20/22/26px.

### Shadows
- Panel: `0 20px 50px rgba(0,0,0,0.14)` (light) / `0 20px 50px rgba(0,0,0,0.6)` (dark).

### Motion
- Theme: `background .25s, color .25s`.
- Panel: `transform .4s cubic-bezier(.22,1,.36,1), opacity .35s ease`.
- Hover/border/bg transitions: `.15s`.

## Assets
Provided in `./assets/` (brand-supplied PNGs, transparent background):
- `repoherald_shield_app_icon.png` — shield mark, **black** (light theme).
- `repoherald_shield_app_icon_white.png` — shield mark, **white** (dark theme).
- `repoherald_primary_horizontal.png` / `_white.png` — full blackletter "RepoHerald"
  masthead lockup (not used in the final nav, included for reference/other placements).

Notes:
- The `⌥` glyph in the "Sign in with GitHub" buttons is a **placeholder** for a real
  GitHub logo icon — swap it for the actual GitHub mark from your icon set.
- Glyphs `★ ◈ ◇ ×` are Unicode text, not images.

## Files
- `repoherald.dc.html` — the full design reference (all sections + interactions +
  both themes). Open in a browser to see it live; toggle theme via the nav button,
  and dismiss/reopen the panel via the "×" and footer "Sponsorships" link.
- `assets/` — brand image assets listed above.
