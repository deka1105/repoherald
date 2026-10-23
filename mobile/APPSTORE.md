# App Store Connect listing — repoherald iOS

Copy-paste fields for the App Store Connect listing. Everything here describes
what **this binary** actually does. Guideline 2.3.1 (accurate metadata) rejects
a listing that describes features the reviewer cannot find — and, just as
importantly, this file has to be rewritten whenever the app grows. It was
rewritten on **2026-10-23**, when the app went from a single feed to the full
set of screens the website has on a phone.

Character limits are Apple's; counts below are exact.

## What is in this build

Native screens, over `/api/mobile/v1` on repoherald.com. No WebView anywhere.

| Tab / screen | What it does |
|---|---|
| **Explore** | The public feed. No account. Sort by top or most donated. |
| **Search** | The public feed, plus repos in your own lists when signed in. |
| **Post** | List a repo you own, or one belonging to an org you're in. |
| **Lists** | Create and browse your lists; Instagram/TikTok lists are labelled. |
| **Wallet** | Credit balance, claim caps, your listings, full credit history. |
| **Account** | Identity, blocked accounts, support, policies, sign out, delete. |
| Repo detail | Stars, language, poster, views, donations, categories, GitHub link, like, claim a star for credit, add to a list, report/block, comments. |
| List detail | A list's repos with notes; add and remove; delete the list. |
| Support | File a support ticket from inside the app, signed in or out. |

**Not in this build, deliberately:** buying credits, spending credits on
highlights, sponsorship/promotion, and the admin portal. The first three are
Guideline 3.1.1 territory — selling or spending a digital currency outside
In-App Purchase — so they stay on the web and the app does not link to them.
The admin portal is staff tooling and does not belong in a consumer binary.

## Fields

| Field | Value | Count |
|---|---|---|
| **App Name** | `repoherald` | 10 / 30 |
| **Subtitle** | `Find and keep GitHub repos` | 26 / 30 |
| **Primary category** | Developer Tools | — |
| **Secondary category** | Productivity | — |
| **Version** | `1.0.0` (never released — 1.0.0 was rejected at review, so the string is reused with a new build number) | — |
| **Age rating** | 4+ (no objectionable content; see note below) | — |
| **Privacy Policy URL** | `https://repoherald.com/privacy` | verified 200 |
| **Support URL** | `https://repoherald.com/support` | verified 200 |
| **Marketing URL** | `https://repoherald.com` | verified 200 |
| **Copyright** | `2026 repoherald` | — |

### Keywords (100 char limit)

```
github,repos,repository,open source,developer,code,oss,discover,projects,lists,saved,dev,tools
```
94 / 100. No spaces after commas (Apple counts them). Does not repeat the app
name or subtitle words — Apple already indexes those, so repeating them wastes
the budget.

### Promotional text (170 chars, editable without a new build)

```
Browse repos people actually wanted to show someone, search everything you have saved, and keep your finds in lists. No account needed to browse.
```
145 / 170.

### Description (4000 chars)

```
repoherald is a feed of GitHub repositories that people have posted because
they thought someone should see them — and a place to keep the ones you want
to find again.

Open the app and the feed is there. No account, no onboarding, no email wall.
Each card shows the project, who owns it, what language it is written in, its
star count and its description. Tap one to read more, or open it on GitHub
where the code actually lives.

WHAT IT IS FOR

Finding a library worth your afternoon is mostly luck. Trending pages reward
whatever is already enormous, and social feeds reward whoever already has an
audience. repoherald is smaller than both and tries to do something simpler:
show you projects a human being chose to put in front of other people.

The other half of the problem is what happens next. You find something good,
you save it somewhere, and three weeks later it is gone — no title, no note,
no search. Lists are the answer to that: private pages of repos with a line
about why each one is there.

WHAT YOU CAN DO

- Browse the feed and sort it by what people have backed.
- Search the feed, and your own lists at the same time.
- Open any repo for its description, language, stars, categories and comments.
- Comment, and read what other people made of a project.
- Keep repos in lists, with a note on why you kept them.
- Post a repo you own, or one from an organisation you belong to.
- Star a repo on GitHub, claim it here, and earn a credit.
- Report anything that should not be here, or block the account behind it —
  both without an account.

IF YOU SIGN IN

Signing in is optional and changes nothing about browsing. It adds posting,
lists, comments and credits. Credits are earned by starring repositories you
genuinely like — the star is a real GitHub action on your own account, and we
verify it with read-only permissions. We cannot write to your repositories,
cannot star anything on your behalf, and cannot see your private code.

You can sign in with Apple, GitHub or Google.

Credits can only be earned in this app. Nothing is sold here.

YOUR ACCOUNT, YOUR DECISION

You can delete your account from inside the app at any time — the Account tab,
then Delete my account. It removes your account and the data attached to it.
There is no email to send and no form to fill in.

The app ships no analytics SDK and no crash reporter. It does not track you
across apps or websites, and there is nothing to opt out of.

WHAT THIS APP IS NOT

It is not a GitHub client. You cannot open issues, review pull requests or read
code here. When you want any of that, the app hands you to GitHub, which is
better at it.
```
~2,540 / 4000.

### What's New

First release — leave blank. App Store Connect does not require release notes
for version 1.0.

## Age rating questionnaire

Answer **None** to every content question. One answer needs thought:

- **"Unrestricted Web Access"** — answer **No**. The app opens specific
  `github.com` repository URLs in the system browser, and four fixed policy
  pages (`/privacy`, `/terms`, `/cookies`, `/refunds`) in an in-app browser.
  There is no address bar the user can type into and no way to reach an
  arbitrary URL from inside the app. (If App Review disagrees, the fallback is
  17+, which would be unfortunate but not fatal.)

## Moderation (Guideline 1.2)

The feed is populated by users (`src/lib/post-repo.ts`, `postRepoFor`), so the
app ships both controls Guideline 1.2 asks for, on every card in every list.

**Report** — the `...` control on any card, a long-press on the card, or
"Report or block" on the repo screen, opens Options -> Report this repo -> a
fixed list of reasons (spam, malware, offensive, misleading, something else).
It POSTs to `/api/mobile/v1/report` and lands in the existing `reports` table,
which the admin moderation queue already reads.

- Works **signed out**. Browsing needs no account, so reporting must not
  either, or the people most likely to see something bad cannot flag it.
  `reports.reporter_user_id` was already nullable.
- The reason is a closed set, never free text. A text field would be a new
  place for a stranger to write anything into the database, and moderators only
  act on the category.
- One open report per signed-in person per listing; tapping twice does not deal
  a moderator two identical rows.

**Block** — the same menu offers "Block <owner>", which hides every listing
from that account across the feed, search and lists. Blocks are stored **on the
device** (`mobile/src/blocks.ts`, via `expo-secure-store`) and never sent to the
server: there is often no server-side "you" to attach them to, and a block list
is a record of who someone dislikes, which this app should not be collecting.
Blocks are undone in the **Account tab -> Blocked accounts**, which is
reachable signed out — because blocking is.

If the whole visible feed is blocked, the empty state says so explicitly rather
than showing "Nothing listed yet.", so blocking never looks like a broken app.

**Comments** are user content too. An author can delete their own from the repo
screen; moderators can delete anyone's, and the row is soft-deleted so it stays
auditable and restorable from `/admin/comments`.

## App Privacy answers

From the code, the app collects only these three, all linked to identity, none
used for tracking, all for App Functionality:

| Data type | Linked | Tracking | Purpose |
|---|---|---|---|
| Email Address | Yes | No | App Functionality |
| Name | Yes | No | App Functionality |
| User ID | Yes | No | App Functionality |

**Usage Data: not collected. Diagnostics: not collected.** The app has no
analytics or crash SDK and never calls the website's view counter — it only
*reads* the counts the web already recorded. Answer **No** to "Do you or your
third-party partners use data for tracking?"

User-generated content (comments, list titles and notes, support messages) is
sent to the server but is not one of Apple's collected-data categories on its
own; it is covered by User ID being linked. If App Review asks, the honest
framing is: comments and lists are stored against the account that wrote them.

These answers must match `ios.privacyManifests` in `app.json`. They do today —
if you change one, change both.

## Screenshots

Required sets: **iPhone 6.9"** (1320 × 2868) and **iPad 13"** (2064 × 2752).
Apple revises these; confirm in App Store Connect before uploading.

Shot list, in order — the first two are what most people ever see:

1. **Explore**, scrolled to the top, full of real repositories.
2. **A repo screen** — description, stars, the GitHub button, a comment or two.
   This is the shot that shows the app is more than a list.
3. **Search**, with a query typed and results under both headings
   ("In your lists" and "On repoherald"). Needs a signed-in account with at
   least one list.
4. **A list** with three or four repos and a note under one of them.
5. **Wallet**, showing a balance and a few history rows.
6. **Account**, showing Blocked accounts and the Danger zone, so review can see
   deletion is reachable without reading the notes.

Capture from a **Release** build on iPhone 17 Pro Max and iPad Pro 13-inch
(M5), status bar overridden to 9:41 / full bars:

```sh
xcrun simctl status_bar "$DEV" override --time 9:41 --cellularBars 4 \
  --wifiBars 3 --batteryState charged --batteryLevel 100
xcrun simctl io "$DEV" screenshot shot.png
```

### Shot 1 is automatable. Shots 2–6 are not. (Established 2026-10-23.)

**Shot 1 is done** — `screenshots/iphone-6.9/01-explore.png` and
`screenshots/ipad-13/01-explore.png`, captured from the build-9 Release binary
at the correct 1320×2868 and 2064×2752. The app launches on Explore, so it
needs no interaction.

**Everything after it needs a tap, and there is no way to tap from a shell
here.** Both obvious routes are closed:

- `simctl` has **no tap verb**, and `idb` / `cliclick` are not installed.
- Deep links do not substitute for tapping. `xcrun simctl openurl` with the
  `repoherald://` scheme makes iOS raise an **"Open in 'repoherald'?"**
  confirmation — on the app if it is foregrounded, on the home screen if it is
  not — and that modal blocks every subsequent command. Two automated runs
  produced six byte-identical screenshots of that dialog before anyone looked
  at them. `simctl openurl` has no flag to suppress it.

So shots 2–6 are a manual pass on a simulator or a device: open the app, tap,
`xcrun simctl io <device> screenshot`. Shots 3, 4 and 5 need a **signed-in
account with a populated list** regardless, so they were never automatable.

If this becomes a recurring chore, the fix is Maestro or `idb` — not more
`simctl`.

**Before you shoot the feed again, check what is in it.** On 2026-10-18 the
third card in production was `simplifaisoul/osiris`, whose description ends in
`…Rqs3ewpump` — a pump.fun token address. A crypto token address in your first
App Store screenshot is a bad look at best and a Guideline 3.1.1 conversation
at worst. Hide or moderate that listing before capturing.

Do not add marketing captions over screenshot 1. Apple's own reviewers and most
browsers judge the first shot in under a second; the bare UI reads as more
honest than a slogan on a gradient.

## Fields that still need a decision from you

The copy above is finished. These are the App Store Connect fields that cannot
be written from the codebase — each has a recommended answer.

| Field | Recommended answer | Why |
|---|---|---|
| **Pricing** | Free | Nothing is sold in the app. |
| **Availability** | All territories | No geo-restricted content or compliance exposure. |
| **Content Rights** — "Does your app contain, show, or access third-party content?" | **Yes** → "I have the necessary rights" | The feed shows public GitHub repository metadata (names, descriptions, avatars) via GitHub's public API. It is third-party content and the honest answer is yes; answering no is the common mistake and triggers a rejection when review notices the avatars. |
| **App Review contact** | Your name, a phone number you will answer, and an email you read | Review calls this if sign-in fails. A dead contact turns a 1-day clarification into a 1-week rejection loop. |
| **Demo account** | Supply one | Browsing needs no account, but review must be able to test **sign-in, lists, posting and account deletion**. Create a throwaway Google or GitHub account, sign into the app once so the row exists, make one list with two repos in it, and put the credentials in the demo fields. Say in the notes that deleting it is expected and fine. |
| **Sign-in required?** | **No** | The feed works signed-out. Answering yes without a demo account is an automatic rejection. |
| **Export compliance** | Already answered | `ITSAppUsesNonExemptEncryption: false` is in the binary, so the questionnaire is skipped at upload. |
| **Attachment** | None needed | — |

### Icon

`assets/icon.png` was **Expo's default template icon with the design
construction guides still on it** — dashed alignment lines, circles and
crosshairs — until 2026-10-18. That is a Guideline 2.3.8 rejection and would
have shipped as the App Store artwork. It is now generated from the real
heraldic mark in `public/brand/shield-white.png` on the brand background,
1024x1024 with no alpha as Apple requires. **Branding is your call** — if you
want a different mark, replace the file and re-run `expo prebuild -p ios`.

## Review notes

See `SUBMISSION.md` and `APPREVIEW-2.1-REPLY.md` — both were rewritten on
2026-10-23 for this build. Two things they get right that are worth not losing:
they explain *why* GitHub sign-in exists (Guideline 4.8 context), and they give
the exact tap path to account deletion, which is the single most common reason
a 5.1.1(v) check gets escalated.
