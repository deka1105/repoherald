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

- **Stack:** Next.js App Router (TS), Auth.js v5 (GitHub OAuth, JWT sessions — no adapter; users upserted in the `jwt` callback in `src/auth.ts`), Neon Postgres + Drizzle (`drizzle-orm/neon-serverless` WebSocket driver — chosen over neon-http because the credit ledger needs interactive transactions with `SELECT ... FOR UPDATE`), Tailwind v4 + shadcn/ui, Stripe Checkout, Vercel Cron.
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
