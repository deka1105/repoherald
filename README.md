# repoherald

**A place to post a repository and have people actually look at it — where attention is earned by giving it.**

Post a repo. Star someone else's and that star mints a credit. Spend credits to
put your own repo at the top of the feed, or donate them to someone else's.

---

## Built with NVIDIA Nemotron on Nebius Token Factory

The hard step in this product is *"which GitHub repository is this social media
post about?"* — and until now that step was **a person**. The landing page said
so. It is the reason the catalogue could never grow faster than somebody's
evening.

That step now runs on **NVIDIA Nemotron, served by Nebius Token Factory**:

- `nvidia/nemotron-3-super-120b-a12b` — the fast tier, on every post
- `nvidia/Nemotron-3-Ultra-550b-a55b` — the deep tier, only on what the fast
  tier got wrong
- **Tavily** — for posts that describe a project and never name it

Measured on 228 real cases, against a no-model baseline run first so the figure
means something:

| | automatic identification |
|---|---|
| regex over literal links (before) | **24.6%** — and 0% of OCR or spoken cases |
| Nemotron on Token Factory (after) | **89.9%**, 1 wrong |

Live demo: **[repoherald.com/identify](https://repoherald.com/identify)** ·
Full write-up, including the three experiments that failed:
**[Identifying a repository from a post](#identifying-a-repository-from-a-post)**

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
   amount of re-reading recovers a name that was never there, so search is the
   only remaining route. Nemotron writes the search query *in the same
   completion that returned the candidates*, so a post that turns out to name
   nothing has already paid for its query. Two searches run: one restricted to
   github.com for the repository page itself, one unrestricted for the
   listicle or thread that names it — a reel and a README rarely describe a
   tool the same way, while an article about it describes it the way people
   talk. Nemotron then picks which result is the project, because searching
   "open source photo editor in Rust" returns the right owner's *other*
   project just as readily, and taking the first link would be picking by
   result order rather than by evidence.

Two tiers because the work is two-speed: most posts name the repo plainly and
want the cheap pass, while a minority are mangled and want real reasoning.
Token Factory's catalogue moves, so both ids are env-overridable and
`npm run nemotron:doctor` checks them against the live `/models` list rather
than trusting a constant that was true the week it was written.

**Which model sits on which tier was decided by measurement, and the result is
not the obvious one:**

| model | measured | tier |
|---|---|---|
| `NVIDIA-Nemotron-3-Nano-30B-A3B` | 25–34s | unused |
| `nemotron-3-super-120b-a12b` | 1–2s | fast |
| `Nemotron-3-Ultra-550b-a55b` | 0.8–1.2s | deep |

The 30B model is reproducibly ~20× slower than the 550B one — four
measurements, no cold-start effect — so the small model is the wrong choice for
the cheap pass here. `Nemotron-3_5-Lightning` is excluded because it writes its
chain of thought into `message.content` instead of `reasoning_content`, which
buries the JSON in prose.

One consequence worth knowing before changing anything: **Nemotron bills its
thinking against `max_tokens`.** A budget that looks generous can be spent
entirely on reasoning and return `finish_reason: "stop"` with empty content,
which is indistinguishable from "found nothing" unless you look. `complete()`
returns `truncated` so callers can tell the difference, and the deep tier gets
a larger budget than the fast one for exactly this reason.

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
  described_only   41  correct   0.0%   wrong  0.0%   unresolved 100.0%
```

`described_only` is the search rung's corpus, and it is the one set of inputs
here that is **not** synthetic: those are the real GitHub descriptions of
catalogued repositories with every mention of the owner and repository name
scrubbed out. Five entries were dropped because their names (`ui`, `You`,
`JOB`) are substrings of ordinary English and so cannot be proved absent. At
0% without search, by construction, anything resolved there is attributable to
Tavily alone.

Without that line, "91% correct" is unreadable — excellent against a 25%
baseline, embarrassing against a 70% one. Three quarters of this corpus is
unreachable without a model, and no regex reconstructs
`ertasselli slash openterminal`.

Measured on 28 Oct 2026 against the live endpoint (Super on the fast tier,
Ultra on the deep tier), with both guards in place and the search rung off —
which is where it stays for these four modes, because they all name something:

| mode | no model | with Nemotron |
|---|---|---|
| `caption_url` | 98.2% | 98.2% |
| `caption_plain` | 0% | **98.2%** |
| `screen` (OCR) | 0% | **70.2%** |
| `narration` (Whisper) | 0% | **93.0%** |
| **228 cases** | **24.6%** | **89.9%**, 1 wrong (0.4%) |

The single wrong answer is arguably ours, not the model's: the catalogue stores
`open-slide/open-slide` and the model returned `openslide/openslide`, which is
the repository that exists. `caption_url` and `caption_plain` were not
re-measured after the guards landed and cannot regress — rung 1 never consults
`isGrounded`, and a caption carrying the name verbatim passes it trivially.

Honest note on the guard's cost: `narration` measured 96.5% before `isGrounded`
and 91.2% / 93.0% across two runs after it. So the guard costs this mode around
4 points, and buys nothing here — narration was already at 0% wrong. It earns
its place on `described_only`, where it cut confident errors from 14.6% to 2.4%.
Trading recall for the elimination of a class of confident error is the right
trade for a catalogue, but it is a trade, not a free win.

1.03 model calls per case, because rung 1 resolves a quarter of the corpus for
nothing and the deep tier only runs on what the fast tier got wrong. Narration
beating OCR by 25 points is the result worth staring at: a dropped hyphen is a
*consistent* transformation, so the model can learn to undo it, while `5`-for-`S`
glyph damage is noise and there is nothing to undo.

### The failure this surfaced, which validation could not catch

`described_only` is reported separately above because it behaved differently
and badly. With no name anywhere in the text, the model stopped reconstructing
and started free-associating to whatever well-known project owns the niche —
returning a **real** repository that was not the right one in 14.6% of cases:

```
chrisgreg/boop            → binwiederhier/ntfy
projectdiscovery/katana   → apify/crawlee
xevrion/breakscale        → jepsen-io/jepsen
```

Every one of those exists, so `fetchPublicRepo` confirmed all of them. **The
GitHub check proves a repository is real; it cannot prove it is the one the
post was about.** "Nemotron proposes, GitHub decides" quietly assumed those
were the same thing.

`isGrounded` in `src/lib/resolve-repo.ts` is the fix: a candidate from a model
rung must have one side of `owner/repo` survive as a run of characters in the
post once case, spacing and punctuation are discarded. `vimax` survives
`HKUD5/ViMax` and `ytdlp` survives "yt dlp slash yt dlp", so real damage still
repairs — but a name that appears nowhere is refused before GitHub is asked.

### And the search rung is a suggestion engine, not an answer

Measuring rung 4 on the 41 scrubbed descriptions it exists for was the most
useful thing in this whole exercise, because it says the rung should not be
trusted:

```
described_only, search ON    correct 65.9%   wrong 34.1%   unresolved 0.0%
described_only, search OFF   correct  0.0%   wrong  2.4%   unresolved 97.6%
```

**Unresolved 0% is the tell.** Search always returns something and the ranking
always picks one of the results, so the rung never abstains. And because search
ranks by authority, an obscure project loses to the category leader it
resembles:

```
Wan-Video/Wan2.2        → Wan-Video/Wan2.1        (right owner, wrong version)
academa-labs/manimgx    → ManimCommunity/manim    (the upstream, not the fork)
chrisgreg/boop          → binwiederhier/ntfy      (the famous alternative)
```

Going from 0% to 65.9% correct looks like a win until you notice it also went
from 2.4% to 34.1% wrong. For a catalogue that is not a trade worth making: an
unresolved post goes to a human, while a wrong one is filed silently against
somebody's saved post.

So a search-sourced resolution carries `needsReview: true` and is **a pre-filled
candidate for the review queue, not a result**. That is still worth having —
it turns a post nobody could identify into one click — but it must not be
auto-applied, and `/identify` says so on screen.

A second gate follows from the same measurement: rung 4 only runs when the post
named *nothing*. With it running whenever the earlier rungs merely failed,
`screen` reached 89.5% correct and **10.5% wrong**, because a half-read name
sent to search comes back as a confident near-miss (`deka1105/ColdEmails` →
`dancolta/trustpilot-outreach-automation`). If a grounded candidate was
proposed, the post does contain a name and the honest answer is "I don't know".

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
NEMOTRON_MODEL_DEEP=…   # optional; defaults to nvidia/Nemotron-3-Ultra-550b-a55b
NEBIUS_BASE_URL=…       # optional; only if your account has a region-suffixed host
TAVILY_API_KEY=…        # optional; enables rung 4
GITHUB_READ_TOKEN=…     # optional; raises GitHub's validation rate limit only
```

Unset `NEBIUS_API_KEY` and identification degrades to literal links. Nothing
breaks — it just stops being clever, exactly as it was before.

The same is true when the model is *configured but unreachable*: an exhausted
balance, a revoked key, an outage. A model call that fails does not throw out
of the ladder. It stops the asking, sets `modelUnavailable`, and lets the
remaining rungs run — the search rung still works, because its query has a
model-free fallback and its ranking already degrades to reading links out of
the results. `/api/identify` then answers **200 with `degraded: true`** and a
plain explanation rather than a 502.

That distinction matters more than it sounds. A demo that says "the model
budget is spent, literal links still work" is a working demo with a caveat; one
that returns 502 is just broken, and nobody clicking the link can tell the
difference between the two causes.

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
