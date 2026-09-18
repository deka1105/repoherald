# Third-party assets and licences

Everything shipped to the browser, and where it comes from. Kept in the repo so
the answer to "are we licensed for that?" is checkable rather than remembered.

## Fonts

All fonts are loaded through `next/font/google`, which downloads them **at build
time and serves them from our own domain**. No request reaches Google at
runtime, so visiting a page does not disclose the visit to a third party. This
is what the cookie policy claims, and it is why.

| Font | Licence | Used for |
|---|---|---|
| Geist | SIL Open Font License 1.1 | `--font-geist-sans` |
| Geist Mono | SIL Open Font License 1.1 | `--font-geist-mono` |
| Inter | SIL Open Font License 1.1 | `--font-inter` |
| JetBrains Mono | SIL Open Font License 1.1 | `--font-jbmono` |

The OFL permits embedding and redistribution, including commercially. It does
not require attribution in the UI, so none is shown; this file is the record.

## Images

| Asset | Source | Licence |
|---|---|---|
| `public/brand/shield-white.png` | This project's own mark | Owned |
| `public/brand/shield-black.png` | This project's own mark | Owned |

The unused Next.js scaffold SVGs (`next.svg`, `vercel.svg`, `file.svg`,
`globe.svg`, `window.svg`) were **removed** — nothing referenced them, and two
of them carry Vercel and Next.js trademarks we have no reason to ship.

Repository avatars and owner avatars are hotlinked from GitHub's CDN
(`avatars.githubusercontent.com`) and belong to their respective owners. They
are displayed as part of listing a public repository, not redistributed.

## Icons

`lucide-react` — ISC License. Permits commercial use and redistribution.

## Runtime dependencies that reach third parties

See the processor table in `/privacy` for the user-facing version.

| Service | Purpose |
|---|---|
| GitHub | OAuth sign-in and star verification |
| Stripe | Payments (their own cookies apply on checkout pages) |
| Neon | Database |
| Vercel | Hosting |
| Resend | Outbound email |
| Sentry | Error monitoring |

There is **no advertising SDK, no third-party analytics, and no tag manager**.
View counting is first-party and cookieless (`src/lib/analytics.ts`).
