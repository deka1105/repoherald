# Your turn — repoherald mobile, 2026-10-23

Everything that could be done without your accounts, your phone or your
judgement is done. Both production builds are **finished and waiting**. What is
left is below, shortest path first. Expect about 40 minutes of your time, plus
however long the recording takes.

---

## The builds

| | Build | Artifact |
|---|---|---|
| **iOS** | 9 (v1.0.0) | https://expo.dev/accounts/aryasoftech/projects/repoherald/builds/edf5f0ff-62df-4bd0-b857-82538c3a907e |
| **Android** | versionCode 5 (built, **not uploaded to Play**) | https://expo.dev/accounts/aryasoftech/projects/repoherald/builds |

---

## 1. ~~Upload to TestFlight~~ — DONE 2026-10-23

Build 9 is in TestFlight and installable now. Confirmed against Apple's API,
not just the exit code:

```
build 9  processing=VALID
  internal TestFlight: IN_BETA_TESTING
  external TestFlight: READY_FOR_BETA_SUBMISSION
```

## 2. Test the signed-in paths on your phone — 10 minutes

This is the one thing no amount of green CI replaces. On 2026-10-18 every gate
was passing while every card in the feed rendered with no title, and the only
thing that caught it was looking at the app.

Install build 9 from TestFlight and walk through:

- [ ] Feed loads **before** you sign in.
- [ ] Tap a card → the repo screen opens (not Safari) → **View on GitHub** works.
- [ ] **Search** finds something. Signed in, results split into *In your lists*
      and *On repoherald*.
- [ ] Sign in with Apple. Then sign out and in with GitHub, and with Google.
- [ ] **Post** a repo you own. It should land on that repo's screen.
- [ ] **Lists**: make one, add a repo by URL, add a note, remove it, delete the list.
- [ ] Post a **comment**, then delete it.
- [ ] **Claim a star**: star something on GitHub, then claim it on the repo
      screen. The Wallet balance and history should both move.
- [ ] **Wallet** shows a balance, claim counters and history rows.
- [ ] Report and block from `•••`, then unblock from **Account → Blocked accounts**.
- [ ] **Delete the account**, and confirm the app lands back on a working
      signed-out feed.

If something fails, the error text on screen is the server's own wording — tell
me the exact string and I can find it immediately.

## 3. Record the review video — 15 minutes

Apple asked for this in the Guideline 2.1 reply and it is the only item I
cannot produce.

**Follow `mobile/RECORDING-SCRIPT.md` exactly.** I rewrote it this session for
the six-tab app; the old version told you to tap a `•••` in the header that no
longer exists. Physical device, one continuous take, about two minutes.

Before you start, make sure the demo account has **one list with two or three
repos in it**, or steps 7–8 are empty screens.

## 4. Screenshots — 15 minutes (1 of 6 is done)

**Done, and verified by looking at them:**

- `screenshots/iphone-6.9/01-explore.png` — 1320×2868
- `screenshots/ipad-13/01-explore.png` — 2064×2752

Both are the real build-9 Release binary on the real feed, status bar at 9:41,
six-tab bar visible. The iPad one confirms the reading column holds and the
cards don't stretch.

**Blocked before you do one thing — see below.**

**The other five need your hands.** `simctl` has no tap verb, `idb` isn't
installed, and deep links don't substitute: `simctl openurl` on the
`repoherald://` scheme makes iOS raise an "Open in 'repoherald'?" modal that
blocks all further automation. I burned two runs on that before looking at the
output. Shots 3, 4 and 5 need a signed-in account with a populated list anyway,
so they were never going to be automatable.

Open the app on a simulator, tap, and run
`xcrun simctl io "iPhone 17 Pro Max" screenshot shot.png`. The shot list is in
`APPSTORE.md`.

**Two stale files are still sitting there:** `01-feed.png` in both folders, and
all three in `playstore/phone/`. They are the *old* single-feed app — no tab
bar, a header control that no longer exists. Uploading one is a Guideline 2.3.3
rejection. I left them rather than delete your assets; delete them yourself, or
say the word.

### ⚠ Deal with `simplifaisoul/osiris` first

It is card 3 of the live feed and its description ends in a pump.fun token
address, `2nZNHm3Lr9umG3DVrzYwHgktwkuKuJRXqqRqs3ewpump`. It is **plainly legible
in both finished screenshots** — truncated on iPhone, complete on iPad.

This is not only a screenshot problem. A reviewer scrolling the feed sees it
too, and a crypto token address in a listing invites a Guideline 3.1.1
conversation about the app itself. Moderating someone else's listing is your
call, not mine, so I have not touched it — but every Explore screenshot will
contain it until you do, and shot 1 will have to be retaken afterwards.

## 5. ~~Paste the metadata into App Store Connect~~ — DONE 2026-10-23

Pushed through the App Store Connect API and read back to confirm:

- **Build 9 attached** to version 1.0 (was build 4). This also moved the
  version out of `REJECTED` into `PREPARE_FOR_SUBMISSION`.
- **Description** — 2,634 chars, now describing search, lists, posting and
  comments instead of a feed-only app.
- **Subtitle** — "Find and keep GitHub repos" (the field was empty).
- **Keywords** — now include `lists`, `saved`, `tools`.
- **Promotional text** — set.
- **Review notes** — 3,963 chars, the build-9 reply (items 2–6 of
  `APPREVIEW-2.1-REPLY.md`), replacing the build-5 text.

Two fields in that section still need you, because they cannot come from a
codebase:

- [ ] **Demo account** — still `demoAccountRequired: false` with an empty name.
      This mattered less when browsing was the whole app; build 9 has posting,
      lists and comments behind sign-in, so review cannot test half of it
      without one. Make a throwaway Google or GitHub account, sign in once,
      give it a list with two repos, then tell me the credentials and I will
      set the fields — or type them into App Store Connect yourself.
- [x] **App Review contact** — already on file (Parag Dekate, 5512477990).
- [ ] **Content Rights** → Yes, I have the necessary rights. Not exposed on the
      API resource I can reach; tick it in the UI.

## Apple's actual rejection text — read once (2026-10-23)

Read straight from the Resolution Center thread, not from notes. Two things in
it change what matters:

**They pre-empted the testing gap themselves:**
> "Before submitting, run the submitted build through your own testing and
> quality assurance process on supported physical devices."

**Under "Prevent Common Issues" they name two of our open items:**
- *2.1 Accessing the app* — "provide up-to-date login credentials for a demo
  account in App Store Connect." The demo account is named in the rejection,
  not optional.
- *2.3.3 Screenshots* — "must show the actual app in use, and not merely the
  title art, login page, or splash screen."

That second one killed a screenshot I had uploaded: `67-03-signin.png` was the
sign-in sheet, which is exactly the "login page" 2.3.3 prohibits. **Deleted
2026-10-23**, along with the stale `01-feed.png` on the iPad set.

The listing now holds exactly one screenshot — `67-06-account.png`. Every slot
needs filling with the app *in use*: the feed, a repo, search results, a list,
the wallet.

Apple's six required reply items map 1:1 onto `APPREVIEW-2.1-REPLY.md`, which
is already pasted into the Notes field. Item 1 — the physical-device screen
recording — is the only one nothing here can produce.

## Already done, don't redo

- **Content Rights** — already "Yes, I have the necessary rights" in App
  Information. It was on the earlier list by mistake.
- **App Review contact** — on file.
- **Build 9** — attached to the submission (`iOS App 1.0 — 1.0.0 (9)`).

## 6. Then press Submit for Review

Only after 2, 3, 4 and 5.

---

## Android — submitted for review 2026-10-23

Seven changes went to Google in one submission. Reviews usually complete within
7 days. Play runs ~14 minutes of automated checks first, then sends them.

| Change | What it does |
|---|---|
| Closed testing – Alpha | versionCode 5 (1.0.0), **Start full rollout** |
| Store listing | new short description |
| Store listing | new full description (2,625 chars, covers all six tabs) |
| Store listing | 7 new phone screenshots, old 3 removed |
| Content rating | new IARC questionnaire → **12+** |
| Target audience | **13+** (9-12 removed) |
| Data safety | corrected collection + encryption answers |

### The two declarations were wrong, not just stale

Worth recording because the failure was silent. Play showed "You're all caught
up", and the live Data safety declaration said:

> Data sharing: **App doesn't collect or share data**
> Security practices: **Data isn't encrypted**

Both false for every version ever shipped — the app has always collected email,
name and user ID through Clerk, and every API call has always been HTTPS. It
now declares: Personal info (Name, Email address, User IDs) and App activity
(Other user-generated content), all *collected, not shared*, optional,
not processed ephemerally, purposes App functionality + Account management,
encrypted in transit, with `https://repoherald.com/account` as the deletion URL.

**Target audience included the 9-12 age group**, which silently put the app
under the Google Play Families policy — a policy a developer-tools app with
user-generated content and outbound links to GitHub does not meet. Now 13+.

**Content rating** had answered *No* to "users interact or exchange content",
true of versionCode 2 and false from 5 on. Answering it honestly moved the
rating from Everyone/3+ to **12+** with "Users Interact", which is the correct
outcome and consistent with the 13+ audience.

### Still yours — I cannot do these

1. **Recruit 12 testers.** 0 are opted in. Production access needs 12 testers
   running the closed test for 14 continuous days, and the clock has not
   started. This is the long pole on any Android launch, not the build.
2. **`mobile/play-service-account.json`.** Still absent. Creating it needs
   Google Cloud + a Play Console permission grant. Without it
   `eas submit --platform android` cannot run, so releases are manual. Note
   the 74 MB upload blocker turned out not to matter: versionCode 5 was already
   in the bundle library, so **Add from library** attached it without an upload.
3. **Feature graphic tagline.** `playstore/feature-graphic.png` still reads
   "A feed of GitHub projects worth your afternoon." Not wrong, but narrower
   than the app now is. There is no generator script for it, so regenerating
   means rebuilding the brand composition — left alone deliberately rather than
   half-edited.
4. **Test sign-in on a real device.** Clerk is verified *configured* for
   Android (`repoherald://sso-callback` allowlisted, GitHub and Google enabled,
   `pk_live_` key in the bundle, intent filter present in the manifest) but the
   OAuth round-trip has never been exercised end to end.

### Two non-blocking warnings Play raised on the release

- App size grew 9.89 MB (26.4 MB for new installs). Expected: one feed became
  six tabs.
- No deobfuscation file, and DEX optimisation is at 1% against a 25% threshold.
  Play's stated deadline is **Feb 2027**. Enabling R8/proguard would address
  both, and would shrink the download.

### Clerk needs nothing for Android — verified

Checked against the production instance rather than guessed:
`repoherald://sso-callback` is allowlisted (`ru_3Ktjc1Rb…`), GitHub and Google
are enabled with custom credentials, `allowed_origins` is unset. The redirect
URL is byte-identical on both platforms, so there was never a per-platform
entry to add.

One *iOS* gap surfaced while looking: `connection_oauth_apple.bundle_id` is
empty on production, and native Sign in with Apple needs it. "Continue with
Apple" is the top button on iOS and what satisfies Guideline 4.8. Fix:
Clerk → Configure → Native applications → add the iOS app (App ID Prefix
`4LX3D498MB`, Bundle ID `com.dekisuki05.repoherald`).

---

## What I changed, in one paragraph

The app was a single feed screen. It is now the website's phone experience,
native throughout: six tabs (Explore, Search, Post, Lists, Wallet, Account) on
Expo Router, plus repo, list and support screens. That needed twelve new
`/api/mobile/v1` endpoints on the Next.js side, which are live on
repoherald.com — and three pieces of server logic (claiming a star, posting a
repo, filing a support ticket) were pulled into shared libraries so the web
form and the app cannot drift on the rules that matter.

**Deliberately not in the app:** buying credits, spending credits on
highlights, sponsorship, and the admin portal. The first three are Guideline
3.1.1 territory; the fourth does not belong in a consumer binary.

## Two things worth knowing

- **Builds 7 and 8 failed** before 9 succeeded. The lockfile was written by
  your npm 11, and EAS installs with npm 10.9.8, which resolves optional peers
  differently — `npm ci` passed locally and died on EAS. The fix and the
  verification command are now written down in `mobile/AGENTS.md`. Read that
  before you next touch dependencies.
- **Every change pushed straight to main and deployed.** That is this repo's
  existing setup, not something I turned on, but it means the new API endpoints
  went live on repoherald.com as they were written. The web build is green and
  the site's own pages were not touched beyond the three shared-logic
  extractions.
