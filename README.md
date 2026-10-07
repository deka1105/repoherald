# repoherald

**A place to post a repository and have people actually look at it — where attention is earned by giving it.**

Post a repo. Star someone else's and that star mints a credit. Spend credits to
put your own repo at the top of the feed, or donate them to someone else's.

---

## The idea

Every "show your project" board has the same failure: everyone posts, nobody
reads. Attention is asked for and never given, so the feed fills with repos whose
authors left immediately after posting.

repoherald makes attention the currency. The only way to get your repo
highlighted is to have genuinely starred someone else's — verified against the
GitHub API with your own token, not taken on trust.

**1 credit = 1 hour of self-highlight, or 15 minutes donated to another repo.**
Donation is deliberately the more expensive rate: giving a stranger the floor
should cost more than taking it yourself.

## How it works

| | |
|---|---|
| **Post** | Submit a GitHub repo to the discovery feed |
| **Star → mint** | Starring a listed repo mints a credit, verified through the GitHub API |
| **Highlight** | Spend credits to pin your repo to the top of the feed |
| **Donate** | Spend credits to highlight someone else's instead |
| **Sponsor** | Paid placement via Stripe Checkout, pinned and injected into the feed |
| **Admin** | Sponsorships, credit adjustments, and moderation |

## Stack

**Next.js App Router** (TypeScript) · **Auth.js v5** with GitHub OAuth and JWT
sessions · **Neon Postgres** with **Drizzle** · **Tailwind v4** and **shadcn/ui**
· **Stripe Checkout** · **Vercel Cron** · **Sentry**

### Four decisions that shaped the schema

**The credit ledger is append-only, and it is the truth.** `credit_entries` is
never updated or deleted; `users.credit_balance` is a cache derived from it and
is allowed to go negative. A balance can be wrong and recoverable. A ledger that
has been edited cannot be audited at all.

**Every credit mutation is one transaction that locks the user row.** All of them
go through `src/lib/credits.ts` — there is no second path. Concurrent spends on
the same balance are the obvious way to mint free credits, and a row lock is the
cheap defence.

**This is why the driver is `neon-serverless`, not `neon-http`.** The ledger needs
interactive transactions with `SELECT ... FOR UPDATE`, which the HTTP driver
cannot do. The WebSocket driver costs a little latency and buys correctness where
it matters.

**Star mints are permanent, including after revocation.** `star_mints` keeps
revoked rows, and `UNIQUE (user_id, repo_id)` means a revoked star can never be
re-minted. Partial unique indexes allow exactly one `mint` and one
`revocation_clawback` per star. Otherwise star, mint, unstar, re-star is an
infinite credit machine.

**Highlight status is always derived from timestamps.** Queries compute it from
`starts_at`/`ends_at`; the `status` column exists for reporting only. A cached
status column and a cron job is a way to have highlights that quietly never
expire.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

Needs `DATABASE_URL` (Neon), GitHub OAuth credentials, and Stripe keys.

```bash
npx drizzle-kit generate    # SQL migration from src/db/schema.ts
npx drizzle-kit migrate     # apply (needs DATABASE_URL)

npm run build               # production build
npm run lint
npx tsc --noEmit            # type-check
```

**No test framework yet.** The invariants above — the ledger, the row locks, the
mint uniqueness — are exactly what should be tested first.

## Scopes

Star verification uses the starring user's own token against
`GET /user/starred/{owner}/{repo}`, with scopes limited to `read:user
user:email`. The app never needs write access to anyone's repositories, and
doesn't ask for it.

## Layout

```
src/db/schema.ts     the schema, and where the invariants live
src/lib/credits.ts   every credit mutation, each one transaction
src/lib/github.ts    GitHub API, star verification
src/auth.ts          Auth.js v5; users upserted in the jwt callback
src/app/             App Router
extension/           browser extension
drizzle/             migrations
```
