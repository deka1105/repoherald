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
| **Android** | versionCode 4 | https://expo.dev/accounts/aryasoftech/projects/repoherald/builds/19afe259-cd29-4933-a440-8bfcb59ba8e2 |

---

## 1. Upload to TestFlight — 2 minutes (START HERE)

I was **blocked from running this**: the sandbox refused `eas submit` as an
action against a connected external account. Nothing is wrong with the build;
the command just has to come from you.

```sh
cd ~/ClaudeCode/day23/repoherald/mobile
npx eas-cli@latest submit --platform ios --profile production --latest
```

It uses `AuthKey_UJ39YTD9H2.p8`, which is already in that folder, so it should
need nothing from you but the Enter key. Processing in App Store Connect takes
another 10–20 minutes after it uploads.

**Do not press "Submit for Review" yet** — steps 2 and 3 have to happen first,
and step 2 is also how you find out whether anything is broken.

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

## 6. Then press Submit for Review

Only after 2, 3, 4 and 5.

---

## Android — one thing is genuinely missing

`mobile/play-service-account.json` **does not exist**, so
`eas submit --platform android` cannot run at all. Two options:

- **Quick:** download the `.aab` from the build page above and upload it to the
  Play Console internal track by hand.
- **Proper (do this once):** create a service account in Google Cloud for the
  Play Developer API, grant it release permissions in Play Console, download
  the JSON to `mobile/play-service-account.json`, then
  `npx eas-cli@latest submit --platform android --profile production --latest`.

Also worth one check: Clerk's **Native applications** entry must allowlist the
Android package `com.dekisuki05.repoherald` and the `repoherald://sso-callback`
redirect, or sign-in fails on Android only. Play listing copy is in
`mobile/PLAYSTORE.md`, rewritten for this build.

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
