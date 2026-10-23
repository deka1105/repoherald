# Reply draft — Guideline 2.1, Information Needed (new submission)

Paste items 2–6 into **both** the App Store Connect reply **and** the Notes field
of App Review Information, as Apple asked. Item 1 is a recording only you can make.

**Rewritten 2026-10-23 for build 9**, which is a much larger app than the one
Apple saw: six tabs (Explore, Search, Post, Lists, Wallet, Account) instead of
a single feed. The shot list and the "setup and access" section below were both
wrong for it and have been replaced. See `RECORDING-SCRIPT.md` for the full
timed version of item 1.

---

## 1. Screen recording

Physical device, latest iOS, starting from launch. **The timed shot list lives
in `RECORDING-SCRIPT.md`** — follow that file, not a summary here, because
every label in it is the exact string in build 9.

In outline: launch with no sign-in wall → open a repo → report it signed out →
block its owner → unblock from the Account tab → sign in with Apple → search,
which also searches your own lists → open a list → post a comment → Wallet →
delete the account → land back on the working signed-out feed.

Keep it one continuous take if you can. Apple asked for the typical user flow,
and registration / login / deletion are explicitly required.

Build 5 added reporting and blocking. Build 9 adds search, posting, lists,
comments and the wallet, so the "typical user flow" is now genuinely longer
than three taps — which is the point of the longer recording.

## 2. Purpose and target audience

repoherald is a feed of public GitHub repositories that people have posted
because they thought someone else should see them — and a place to keep the
ones you want to find again.

The audience is software developers and technically-minded readers who want to
find open-source projects worth their time.

The problem it solves: finding a genuinely useful repository is mostly luck.
GitHub's trending page rewards what is already enormous, and social feeds reward
whoever already has an audience. repoherald is smaller than both and shows
projects a person deliberately chose to put in front of other people.

The second half of the problem is what happens after you find something. People
save a repo somewhere, and weeks later it is gone — no title, no note, no
working search. Lists are the answer to that: private, link-shareable pages of
repos with a line about why each one is there, searchable alongside the public
feed.

The value: a small human-curated feed that requires no account to read, applies
no ranking algorithm, collects no usage data — and keeps what you found.

## 3. Setup and access instructions

**No credentials are required to review the app.** Launch it and the feed loads
immediately — there is no onboarding, no registration wall and no email gate.
Tap any card to open that repository on github.com.

Signing in is entirely optional and changes nothing about browsing. It adds
posting, lists, comments, and earning credits by starring repositories on your
own GitHub account.

We cannot supply a fixed demo account because sign-in is delegated entirely to
Apple, GitHub and Google; there are no app-specific passwords to issue. To test
the signed-in state, please use **Continue with Apple** with any Apple ID — that
path requires nothing from us and creates the account on first use.

Account deletion (required, and present in this build): the **Account** tab →
**Delete my account** → confirm **Delete permanently**. It deletes the profile
and the GitHub connection and hides the user's posts. There is no email to send
and no web form to fill in.

**What needs an account:** posting a repo, lists, comments and credits. Explore,
Search (public results), opening a repo, reporting and blocking all work signed
out.

## 4. External services used to deliver core functionality

| Service | Role |
|---|---|
| Clerk (clerk.com) | Identity and authentication — Sign in with Apple, GitHub, Google |
| Neon (neon.tech) | Hosted PostgreSQL database |
| Vercel (vercel.com) | Hosting for repoherald.com, which serves the app's API |
| GitHub REST API | Source of all repository metadata shown in the feed, and verification that a user starred a repository. Read-only scopes only (`read:user`, `user:email`) |

The app contains **no** advertising SDK, **no** analytics SDK, **no** crash or
diagnostics reporter, and **no** AI service. It requests no advertising
identifier — `com.google.android.gms.permission.AD_ID` has no iOS equivalent in
this build, and `NSPrivacyTracking` is `false` in the shipped privacy manifest.

No payment processor is reachable from the iOS app. Credits can only be
**earned** inside the app — by starring a repository on GitHub and claiming it
— never purchased and never spent. The Wallet screen is read-only. There is no
sponsorship or promotion flow in the binary, and the app does not link to any
purchase page on the website.

## 5. Regional differences

The app functions identically in every region. There is no geo-gating, no
region-specific content or pricing, and no locale-dependent behaviour; the feed
API applies no country or region logic of any kind. The app ships in English
only. It is the same feed everywhere.

## 6. Regulated industry / third-party material

repoherald does not operate in a regulated industry.

All content shown is publicly available metadata about public GitHub
repositories — repository name, owner, description, primary language, star count
and owner avatar — retrieved through GitHub's public REST API under GitHub's
Terms of Service. The app does not host, mirror, modify or redistribute
repository source code. Tapping a card hands the user to github.com, where the
code actually lives.

---

## User-generated content and moderation (Guideline 1.2)

The feed shows listings submitted by users, so this build ships both controls:

- **Report** — the `...` control on any card, or a long-press, opens Options →
  Report this repo → a fixed list of reasons. Reports go to the moderation queue
  that already backs the website. **Reporting works signed out**, because
  browsing works signed out; requiring an account would mean the people most
  likely to encounter something objectionable have no way to flag it.
- **Block** — the same menu offers Block, which hides every listing from that
  account, across the feed, search results and lists. Blocks are stored on the
  device and are reversible from the **Account tab → Blocked accounts**, which
  is reachable signed out because blocking is.
- **Comments** are user content too. Authors delete their own from the repo
  screen; moderators delete anyone's, and the row is soft-deleted so it stays
  auditable and restorable.

Builds 1–4 had neither control. Build 5 added report and block. Build 9, the
one submitted with this reply, adds comments — and with them the author and
moderator delete paths above.
