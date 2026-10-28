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

## Identifying a repository from a post

**NVIDIA Nemotron on Nebius Token Factory.** Try it: [`/identify`](https://repoherald.com/identify)

When someone sends repoherald a post instead of saving it, something has to
answer *which repository is this?* Until now that something was a person — the
landing page said so out loud, *"A person looks up the repository behind it"* —
and it is why the catalogue could never grow faster than somebody's evening.

The inputs are the three places a repo can be named, in descending fidelity:

| Source | Fidelity | Typical damage |
|---|---|---|
| Caption | highest | often a literal `github.com` URL, or absent entirely |
| Screen (OCR) | near-verbatim | mangled glyphs — `5` for `S`, `1` for `l`, `0` for `O` |
| Narration (Whisper) | lossiest | punctuation is *spoken*: `yt-dlp/yt-dlp` arrives as "yt dlp slash yt dlp" — the slash is said aloud, the hyphens are not said at all |

### The rule that makes it safe to automate

**Nemotron proposes. GitHub decides.**

Every candidate is checked against `GET /repos/{owner}/{repo}`, and one that
does not resolve is discarded however confident the model sounded. The model
never names the output — it only narrows the search. A wrong guess costs one
API call; a hallucinated repository sitting in someone's private list costs
their trust in the entire product.

That is enforced rather than promised: `tests/resolve-repo.test.ts` feeds the
ladder a model that invents repositories with `confidence: 1.0` and asserts
nothing comes back.

### The ladder

`src/lib/resolve-repo.ts`, cheapest rung first, stopping at the first candidate
GitHub confirms:

1. **A literal URL** — a regex reads a URL correctly, and spending a token to
   read one would be silly. Costs zero model calls.
2. **Nemotron, fast tier** — over all three texts at once.
3. **Nemotron, deep tier** — told *which candidates GitHub already rejected*, so
   it repairs instead of repeating itself. This is the rung that undoes spoken
   punctuation.
4. **Tavily** — only when the post describes a project and never names it. No
   amount of re-reading recovers a name that was never there.

Two tiers because the work is two-speed: most posts name the repo plainly and
want the cheap pass, while a minority are mangled and want real reasoning.
Token Factory's catalogue moves, so both ids are env-overridable and
`npm run nemotron:doctor` checks them against the live `/models` list rather
than trusting a constant that was true the week it was written.

### Measuring it

```bash
npm run nemotron:doctor              # key, model ids, and one real inference
npm run test:resolve                 # the ladder — no key, no tokens, no network
npm run test:nemotron                # the HTTP contract, against a local server
npm run eval:resolve -- --baseline   # the no-model bar, free
npm run eval:resolve -- --limit 20   # accuracy against the real endpoint (spends tokens)
npm run eval:resolve -- --mode narration
```

Start with `--baseline`. It runs the whole corpus with the model stubbed out,
so only rung 1 can resolve anything, and that is the bar Nemotron has to clear:

```
  mode            n   outcome
  caption_url      57  correct  98.2%   wrong  0.0%   unresolved   1.8%
  caption_plain    57  correct   0.0%   wrong  0.0%   unresolved 100.0%
  screen           57  correct   0.0%   wrong  0.0%   unresolved 100.0%
  narration        57  correct   0.0%   wrong  0.0%   unresolved 100.0%
  ALL             228  correct  24.6%   wrong  0.0%   unresolved  75.4%
```

Without that line, "72% correct" is unreadable — excellent against a 25%
baseline, embarrassing against a 70% one. Three quarters of this corpus is
unreachable without a model, and no regex reconstructs
`ertasselli slash openterminal`.

Running it also found two repositories in the catalogue that have since been
renamed and one that was deleted — caught by validating against GitHub rather
than trusting a stored name. The eval compares repo ids, so a rename counts as
correct.

The eval reports three outcomes, deliberately not two:

- **correct** — resolved, and it is the right repository
- **wrong** — resolved to a *real* repository that is not the right one. The
  only harmful outcome, because it enters a list looking like a correct answer
- **unresolved** — nothing survived GitHub. Safe: the post falls back to the
  review queue, which is where every post went before any of this existed

An identifier that is unsure and says so is worth more here than one that is
usually right, so *wrong* is reported on its own line and never folded into an
accuracy percentage.

**Two honest limits.** Ground truth is the 57 repositories repoherald has really
catalogued, pulled from the production database — but the mangled text those
were originally read from is not preserved anywhere, so the eval *inputs* are
generated (`tests/corrupt.ts`), with each mode reproducing a failure the
pipeline actually hit. It therefore measures reconstruction from damaged text,
not end-to-end production accuracy. And because the eval's ground truth is a
closed set of 57, a plausible-but-wrong *real* repository is scored wrong,
where in production it would resolve and be accepted — so the real-world
"confidently wrong" rate is higher than the eval's, not lower.

### Setup

```bash
NEBIUS_API_KEY=…        # required for anything past rung 1
NEMOTRON_MODEL_FAST=…   # optional; defaults to nvidia/nemotron-3-super-120b-a12b
NEMOTRON_MODEL_DEEP=…   # optional; same default
NEBIUS_BASE_URL=…       # optional; only if your account has a region-suffixed host
TAVILY_API_KEY=…        # optional; enables rung 4
GITHUB_READ_TOKEN=…     # optional; raises GitHub's validation rate limit only
```

Unset `NEBIUS_API_KEY` and identification degrades to literal links. Nothing
breaks — it just stops being clever, exactly as it was before.

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

## Repo lists

Link-shareable curated pages (`repo_lists` / `repo_list_items`). Slugs carry a
random suffix so lists aren't enumerable, and contributions stay open to any
signed-in visitor until the owner closes them.

**List items may only reference repos already in `repos`.** Accepting an
arbitrary GitHub URL here would create a listing that bypassed `postRepo`'s
owner/org check — the whole point of which is that you can only post what you
actually control.

## Secrets and compliance

**GitHub tokens are encrypted at rest** — AES-256-GCM via `src/lib/crypto.ts`,
keyed by `TOKEN_ENCRYPTION_KEY`. See `.env.example` for the full set.

**View counting is first-party and cookieless.** A daily-rotating salted hash of
IP + user agent; the IP is never stored. Consent is checked at send time and
Global Privacy Control is honoured automatically. Storage that fails to read
counts as opted *out*, not opted in.

**The policy pages are derived from the code.** `/privacy`, `/terms`,
`/cookies` and `/refunds` live in `src/app/(legal)/`, and every factual claim in
them comes from actual behaviour. If you change what is collected, stored,
charged or refunded, update the matching page **in the same commit**.

Business identity is read from environment variables and the operator block is
*omitted* when they're unset — never hardcode or invent a company name.

## Migrations

Two failure modes worth knowing, both learned the hard way:

- **Never edit an applied migration.** Drizzle records it in the journal and
  won't re-run it. Add a new one.
- **Never hand-write a future `when` timestamp** in `drizzle/meta/_journal.json`.
  Drizzle only applies entries newer than the last applied migration, so a
  future-dated entry makes every later migration silently skip — and
  `drizzle-kit migrate` still prints success while applying nothing.

Code ships on push to main, so apply schema migrations to Neon *before or with*
the push, never after.

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

Tests are plain `tsx` scripts rather than a framework, and run without a
database or any API key:

```bash
npm run test:mobile-auth    # the bearer-token layer
npm run test:resolve        # the repo-identification ladder
npm run test:nemotron       # the Token Factory client's HTTP contract
```

80 assertions, none of which need a key, a database or the internet — the
Nemotron client is exercised against a local server that speaks Token
Factory's documented shapes, including the retry rules.

The remaining invariants — the ledger, the row locks, the mint uniqueness —
are what should be covered next.

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
