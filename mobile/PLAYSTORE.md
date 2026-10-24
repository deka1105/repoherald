# Google Play listing — repoherald Android

Copy-paste fields for the Play Console listing. As with `APPSTORE.md`, this
describes **this binary only**. Play's policy on deceptive store listings is as
strict as Apple's and enforced by automated scanning.

**Rewritten 2026-10-23 for versionCode 4.** The app is no longer a single feed:
it has six tabs (Explore, Search, Post, Lists, Wallet, Account), so repo lists
*are* now in the binary and the listing says so. Still **not** in it, and still
absent from this listing: sponsorship, buying credits, spending credits, and
Instagram/TikTok ingest (claiming a handle happens on the web; the app only
shows the lists that ingest fills).

Shares `app.json`, the API and the codebase with iOS. Differences from
`APPSTORE.md` are called out; where this file is silent, the iOS answer applies.

## Store listing

| Field | Value | Count |
|---|---|---|
| **App name** | `repoherald` | 10 / 30 |
| **Short description** | `Find GitHub projects worth your time, and keep the ones you want again.` | 71 / 80 |
| **Category** | Developer tools | — |
| **Tags** | Open source, Developer, Productivity | — |
| **Contact email** | *your support address* | required, shown publicly |
| **Contact website** | `https://repoherald.com` | — |
| **Privacy policy** | `https://repoherald.com/privacy` | required, verified 200 |

### Full description (4000 chars)

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

You can sign in with Google or GitHub.

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
~2,450 / 4000. **Note the one deliberate difference from the iOS description:**
it says "Google or GitHub", not Apple — `src/signin.tsx` only offers Apple on
iOS, and naming an unavailable method in the listing is a policy violation.

## Graphics

| Asset | Spec | Status |
|---|---|---|
| App icon | 512 × 512, 32-bit PNG | `assets/play-icon-512.png` — generated 2026-10-18 from the real brand mark |
| Feature graphic | 1024 × 500, no alpha | `playstore/feature-graphic.png` — generated 2026-10-18 |
| Phone screenshots | 2–8, min 320px, 16:9 or 9:16 | **Not captured — see below** |
| 7" tablet | optional but recommended | — |
| 10" tablet | optional but recommended | reuse the iPad composition |

**Superseded.** The 2026-10-18 set (`01-feed.png`, `02-feed-scrolled.png`,
`03-signin.png`, Pixel 8 emulator, 1080 x 2400) is of the *single-feed* app —
versionCode 2, before the six-tab rewrite — so it no longer shows what the
binary does. Shipping it would be the Play equivalent of the 2.3.3 problem
Apple raised. `03-signin.png` is a login screen and should not come back in any
case. Recapture against versionCode 5.

Two capture notes worth keeping:

- **Do not use SystemUI demo mode** to fake a clean status bar. The broadcasts
  (`com.android.systemui.demo`) wedged SystemUI into a repeating "System UI
  isn't responding" dialog that sat over every screenshot. Backing demo mode out
  fixed it immediately. The real status bar reads fine.
- `adb install` of the 74 MB APK fails with a broken pipe on this emulator.
  `adb push` to `/data/local/tmp/` then `adb shell pm install` works every time.
  A locally-signed rebuild also needs `adb uninstall` first, since it will not
  replace the EAS-signed one (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`).

**Still to capture:** a 7" and 10" tablet set (optional but recommended), and
the account sheet, which needs a signed-in session.

Without a feature graphic Play will not let you publish — it is the one asset
people most often discover missing at the end.

## Data safety form

Play's data safety declaration is **separate from, and stricter than, Apple's
App Privacy**: it asks about collection *and* sharing, and whether data is
encrypted in transit and deletable. Answers from the code:

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Data types collected | **Personal info → Email address, Name, User IDs**; **App activity → Other user-generated content**; **Device or other IDs → none** |
| What the user-generated content is | Comments on listings, list titles and descriptions, and the repo listings themselves — all written from inside the app |
| Is a User ID collected? | **Yes** — Personal info → User IDs |
| Is any of it *shared* with third parties? | **No** |
| Is data encrypted in transit? | **Yes** — all API calls are HTTPS to `repoherald.com` |
| Can users request data deletion? | **Yes** — in-app, and the URL below |
| Account deletion URL | `https://repoherald.com/account` |
| Is data collection optional? | **Yes** — the feed works fully signed-out |
| Purpose for each type | **App functionality** only |
| Is the user-generated content publicly visible? | **Yes** — comments, lists and listings are public on repoherald.com. Declare it as collected, not shared: Play counts "shared" as transfer to a *third party*, which this is not. |

Play also requires a **publicly reachable account-deletion path for users who
have uninstalled the app**. The in-app route satisfies the in-app half; make
sure the web route at `/account` is reachable and documented, or Play will flag
it.

## Content rating (IARC questionnaire)

Answer **No** to every content category — violence, sexuality, language,
controlled substances, gambling, horror. Two that need thought:

- **"Does the app allow users to interact or exchange content?"** — **Yes.**
  This changed with the six-tab rewrite and is the single answer most likely to
  be wrong on an existing listing. The binary writes comments (`postComment`),
  posts listings (`postRepo`), creates lists (`createList`) and files reports
  (`reportRepo`). Answering **No** here — correct for versionCode 2, false from
  versionCode 5 on — is an inaccurate declaration, which Play enforces against.
  Because the answer is Yes, Play's user-generated content policy also requires
  an in-app way to report content and block users: `src/moderation.tsx` provides
  both (report with reasons, plus an on-device owner block), so the requirement
  is already met — do not remove it.
- **"Does the app share the user's location?"** — **No.**
- **"Does the app allow purchases?"** — **No.** Credits are earned only.

Expected outcome: **Everyone / PEGI 3**.

## Other declarations

| Declaration | Answer |
|---|---|
| Ads | **No ads.** Sponsored placement exists on the website; this binary never renders it. |
| In-app purchases | **No** |
| Target audience | 13+ (not directed at children — avoids Families policy entirely) |
| App access | **All functionality available without special access.** Provide a demo account anyway so review can test sign-in and deletion. |
| Government app | No |
| Financial features | No |
| Health | No |
| Data deletion | In-app, plus `https://repoherald.com/account` |

## Android bugs found by running it, 2026-10-18

**3. The modal sheets had the same status-bar collision as the header**, found
after fixing the header. `presentationStyle="pageSheet"` is **iOS-only** —
Android ignores it and renders the Modal full-screen, so "Sign in" sat on the
clock and "Done" on the wifi and battery icons. `signin.tsx` and `account.tsx`
had no safe-area handling at all.

Fixing the header alone would have shipped a half-fix. The inset now lives once
in `src/theme.ts` as `ANDROID_TOP_INSET` and is imported by all three roots,
so a fourth full-bleed root cannot quietly miss it.

### The first two

Both were invisible to `tsc`, `eslint` and `expo-doctor`, and both would have
been in every Play Store screenshot.

**1. The header drew under the system status bar.** `App.tsx` wrapped the root
in `SafeAreaView` imported from `react-native` — which applies insets **on iOS
only**. On Android it is a plain `View`, so "REPOHERALD" rendered on top of the
system clock and "Sign in" on top of the wifi and battery icons.
`react-native-safe-area-context` is not installed, so the root now applies
`StatusBar.currentHeight` as top padding on Android, and the list gets extra
bottom padding for the gesture bar. From API 35 Android is edge-to-edge by
default, so this is not cosmetic — it gets worse, not better, on new devices.

> If you later add `react-native-safe-area-context` (Expo's recommended
> approach, and the one that handles notches and landscape properly), replace
> the manual padding with `useSafeAreaInsets` rather than stacking both.

**2. Feed cards had no titles** — the same `FeedRepo` cast bug documented in
`SUBMISSION.md`. It affected both platforms.

## Permissions — fixed 2026-10-18

Expo's prebuild template declares these in `android/app/src/main/`, which merges
into the **release** manifest:

| Permission | Needed? | Why it was there |
|---|---|---|
| `INTERNET` | **Yes** | The API. Kept. |
| `SYSTEM_ALERT_WINDOW` | No | Template default. Users see this as **"Display over other apps"** — a sensitive permission that hurts install conversion and draws Play scrutiny. |
| `READ_EXTERNAL_STORAGE` | No | Template default. `expo-image` caches to internal app storage. |
| `WRITE_EXTERNAL_STORAGE` | No | Template default. |
| `VIBRATE` | No | Template default. Nothing in the app vibrates. |

The four unneeded ones are now listed in `android.blockedPermissions` in
`app.json`, so the shipped manifest requests only `INTERNET`. React Native's
dev-menu overlay declares its own `SYSTEM_ALERT_WINDOW` in `src/debug/`, which
is a separate manifest that never ships.

**If the debug dev-menu overlay misbehaves locally**, drop
`SYSTEM_ALERT_WINDOW` from the blocked list — the manifest-merger `remove`
directive can reach the debug variant too. The release manifest is what matters
for Play; the other three are safe to block unconditionally.

Verify after any prebuild:

```sh
grep -oE 'android.permission.[A-Z_]+' android/app/src/main/AndroidManifest.xml | sort -u
```

## What was verified on 2026-10-18

| Check | Result |
|---|---|
| `expo prebuild -p android --clean` | clean, exit 0 |
| `expo run:android --variant release` | **BUILD SUCCESSFUL**, APK produced and installed |
| App launches on Pixel 8 emulator, API 36 | yes, feed loads live production data |
| `tsc --noEmit` | clean |
| Adaptive icon | `ic_launcher.xml` carries background, foreground **and** monochrome |
| `blockedPermissions` | 4 x `tools:node="remove"` in the merged source manifest; only `INTERNET` survives the merge |

The only thing a clean prebuild does **not** show is the final merged manifest —
`tools:node="remove"` is applied by the manifest merger at build time, so the
source still lists all five. Verify the shipped artifact once, after an EAS
build, with:

```sh
aapt2 dump xmltree --file AndroidManifest.xml <your>.apk | grep -A1 uses-permission
```

## Build and submit

`eas.json` already has an Android submit profile on the `internal` track.

```sh
cd mobile
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android --profile production
```

### Blockers, in order

**Re-checked 2026-10-23.** Three of the five below were done between 10-18 and
10-23 and are struck out; only the first is still open.

1. **`mobile/play-service-account.json` is absent.** `eas.json` expects it and
   it is gitignored, so `eas submit --platform android` cannot run. Create a
   service account in Google Cloud for the Play Developer API, grant it release
   permissions in Play Console, download the JSON and put it at
   `mobile/play-service-account.json`. This is the Android equivalent of the
   `AuthKey_*.p8`, which **is** present. Until it exists, the `.aab` has to be
   uploaded to the internal track by hand from the EAS build page.
2. ~~No EAS project linked.~~ Done — project `7590d365-7da9-4a57-a134-c9b7fce48cf4`,
   owner `aryasoftech`, and Android builds are running (versionCode 4).
3. ~~`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` for the production environment.~~ Done
   — the EAS `production` environment holds the `pk_live_` key, and the
   versionCode 5 bundle really does carry `pk_live_Y2xlcmsucmVwb2hlcmFsZC5jb20k`
   (checked with `strings` on `base/assets/index.android.bundle`, which is Hermes
   bytecode but keeps its string table greppable). **Clerk needs nothing for
   Android** — verified 2026-10-23 against the production instance: the redirect
   `repoherald://sso-callback` is allowlisted (`ru_3Ktjc1Rb…`), GitHub and Google
   are enabled with custom credentials, and `allowed_origins` is unset. The
   redirect URL is byte-identical on both platforms, so there was never a
   per-platform entry to add. One *iOS* gap did turn up: `connection_oauth_apple
   .bundle_id` is empty, which native Sign in with Apple needs — see APPSTORE.md.
4. ~~Deploy the web app.~~ Done — the full `/api/mobile/v1` surface is live on
   repoherald.com and the web build is green.
5. **Play App Signing** — accept it when prompted. It is effectively mandatory
   for new apps and lets Google re-sign; EAS handles the upload key.

### Not a blocker, but do it once

Play requires new apps to target a recent API level. Expo SDK 57 / React Native
0.86 targets API 36, which satisfies the current requirement — confirm in the
generated `android/app/build.gradle` after `expo prebuild -p android` rather
than taking this on trust, since the floor rises every August.
