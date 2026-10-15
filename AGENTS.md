<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# repoherald

Portal where people/companies post GitHub repos for discovery and starring. Verified stars mint credits (1 credit = 1h self-highlight or 15min donated highlight). Sponsored repos get pinned/injected feed placement. Admin portal manages sponsorships, credits, moderation.

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx tsc --noEmit` — type-check
- `npx drizzle-kit generate` — generate SQL migration from `src/db/schema.ts`
- `npx drizzle-kit migrate` — apply migrations (needs `DATABASE_URL`)

No test framework yet.

## Architecture

- **Stack:** Next.js App Router (TS), Clerk for identity (see **Auth** below), Neon Postgres + Drizzle (`drizzle-orm/neon-serverless` WebSocket driver — chosen over neon-http because the credit ledger needs interactive transactions with `SELECT ... FOR UPDATE`), Tailwind v4 + shadcn/ui, Stripe Checkout, Vercel Cron.
- **Auth:** Clerk, with the Google and GitHub connections configured in the Clerk dashboard rather than in env. `src/auth.ts` wraps Clerk's `auth()` and resolves it to a row in `users` via `src/lib/clerk-user.ts`: Clerk owns identity, that table still owns role, credits, mint eligibility and claimed handles. An account predating Clerk is adopted on first sign-in by **verified** email only (`src/lib/account-link.ts`) — an unverified address would let anyone who can type it walk into the account that owns it. Middleware is `src/proxy.ts` (Next 16 renamed `middleware.ts`) and deliberately does **not** gate routes; authorisation is per-page and per-action via `requireUser`/`requireModerator`/`requireAdmin`, which need the DB for roles. GitHub tokens come from `src/lib/github-token.ts`, which reads Clerk for web users and the locally encrypted token for mobile — mobile does its own GitHub exchange and never goes through Clerk. **Admins** come from two env lists, never from a signup: `ADMIN_GITHUB_LOGINS` (unreachable for a Google-only account, which has no login) and `ADMIN_EMAILS` — *primary* admins, granted on every sign-in with that **verified** address and refused by `setUserRole`, so no admin can demote the operator. Changing who is a primary admin is an env change plus a redeploy, deliberately: a DB write must not be able to grant admin.
- **Schema:** `src/db/schema.ts`. Key invariants: `star_mints` is permanent (revoked rows still block re-minting via `UNIQUE (user_id, repo_id)`); `credit_entries` is an append-only ledger and the source of truth for `users.credit_balance` (cache, may go negative); partial unique indexes allow one `mint` and one `revocation_clawback` per star.
- **Credit mutations** all go through `src/lib/credits.ts`, each a single transaction locking the user row.
- **GitHub API:** `src/lib/github.ts` — star verification uses the starring user's own token (`GET /user/starred/{owner}/{repo}`), scopes `read:user user:email` only.
- **Highlight status** is always derived from `starts_at`/`ends_at` timestamps in queries; the `status` column is reporting-only.
- **Repo lists** (`repo_lists`/`repo_list_items`, queries in `src/lib/lists.ts`, mutations in `src/app/actions/lists.ts`): link-shareable curated pages. Slugs carry a random suffix so lists aren't enumerable; contributions are open to any signed-in visitor until the owner closes them. List items may only reference repos already in `repos` — accepting an arbitrary GitHub URL here would create a listing that bypassed `postRepo`'s owner/org check.
- **Env vars:** see `.env.example`. `TOKEN_ENCRYPTION_KEY` encrypts GitHub tokens at rest (AES-256-GCM in `src/lib/crypto.ts`).

## Migration gotchas (learned the hard way)

- Never edit an already-applied migration file — drizzle records it in the journal and won't re-run it; add a new migration instead.
- Never hand-write a future `when` timestamp in `drizzle/meta/_journal.json`: drizzle only applies entries whose `when` is greater than the last applied migration's `created_at`, so a future-dated entry makes every later migration get silently skipped (`drizzle-kit migrate` prints success even when it applies nothing).
- Code ships to prod on push to main; apply schema migrations to Neon before/with the push, never after.
- Pricing is DB-driven (`sponsor_plans` via `src/lib/pricing.ts`); never hardcode plan prices in UI — render them with `src/components/plan-price.tsx`.

## Legal & compliance

- Policy pages live in the `src/app/(legal)/` route group: `/privacy`, `/terms`, `/cookies`, `/refunds`. Every factual claim in them is derived from the code — **if you change what is collected, stored, charged, or refunded, update the matching page in the same commit.**
- Business identity comes from `src/lib/legal.ts`, which reads `LEGAL_ENTITY_NAME` / `LEGAL_ENTITY_ADDRESS` / `LEGAL_JURISDICTION` / `LEGAL_CONTACT_EMAIL`. Unset values make the pages **omit** the operator block — never hardcode a company name or address, and never invent one.
- View counting is first-party and cookieless (`src/lib/analytics.ts`: daily-rotating salted hash of IP+UA, IP never stored). `src/lib/analytics-consent.ts` gates it — `trackEvent` checks the opt-out at send time and honours Global Privacy Control automatically. Storage that fails to read counts as opted OUT.
- `StorageNotice` is a notice, not a consent wall: only two cookies exist (auth session, feed layout) and both are consent-exempt. Do not turn it into an "Accept all" modal — both buttons are deliberately the same visual weight.
- Marketing email must carry a working unsubscribe. `src/lib/unsubscribe.ts` signs a per-recipient token (HMAC over the user id, no expiry) and `notify.ts` sets `List-Unsubscribe` + `List-Unsubscribe-Post`. `unsubscribeUrl()` returns **null** rather than throwing when `AUTH_SECRET` is unset, so a misconfigured env degrades to an email without one-click rather than sending nothing.
- Accessibility floors that are already met — do not regress them: `--muted-foreground` clears 4.5:1 on both `--background` and `--muted` in all three dark themes, `--ring` clears 3:1, focus outlines are solid (not alpha-reduced), every `<main>` has `id="main"` for the skip link, and decorative logos beside their own text keep `alt=""` on purpose.
- Asset licences are recorded in `ATTRIBUTION.md`. Fonts are self-hosted by `next/font/google` at build time, so no request reaches Google at runtime — the cookie policy says so, keep it true.
