# Google Play listing — repoherald Android

Copy-paste fields for the Play Console listing. As with `APPSTORE.md`, this
describes **this binary only** — no repo lists, no Instagram/TikTok ingest, no
sponsorship, no buying credits. Play's policy on deceptive store listings is as
strict as Apple's and enforced by automated scanning.

Shares `app.json`, the API and the codebase with iOS. Differences from
`APPSTORE.md` are called out; where this file is silent, the iOS answer applies.

## Store listing

| Field | Value | Count |
|---|---|---|
| **App name** | `repoherald` | 10 / 30 |
| **Short description** | `A feed of GitHub projects worth your afternoon.` | 47 / 80 |
| **Category** | Developer tools | — |
| **Tags** | Open source, Developer, Productivity | — |
| **Contact email** | *your support address* | required, shown publicly |
| **Contact website** | `https://repoherald.com` | — |
| **Privacy policy** | `https://repoherald.com/privacy` | required, verified 200 |

### Full description (4000 chars)

```
repoherald is a feed of GitHub repositories that people have posted because
they thought someone should see them.

Open the app and the feed is there. No account, no onboarding, no email wall.
Each card shows the project, who owns it, what language it is written in, its
star count and its description. Tap one and it opens on GitHub, where the code
actually lives.

WHAT IT IS FOR

Finding a library worth your afternoon is mostly luck. Trending pages reward
whatever is already enormous, and social feeds reward whoever already has an
audience. repoherald is smaller than both and tries to do something simpler:
show you projects a human being chose to put in front of other people.

Pull to refresh. Scroll for more. That is the whole app.

IF YOU SIGN IN

Signing in is optional and changes nothing about browsing. It exists so you can
earn credits by starring repositories you genuinely like — the star is a real
GitHub action on your own account, and we verify it with read-only permissions.
We cannot write to your repositories, cannot star anything on your behalf, and
cannot see your private code.

You can sign in with Google or GitHub.

Credits can only be earned in this app. Nothing is sold here.

YOUR ACCOUNT, YOUR DECISION

You can delete your account from inside the app at any time — Credits, then
Delete my account. It removes your account and the data attached to it. There
is no email to send and no form to fill in.

The app ships no analytics SDK and no crash reporter. It does not track you
across apps or websites, and there is nothing to opt out of.

WHAT THIS APP IS NOT

It is not a GitHub client. You cannot open issues, review pull requests or read
code here. When you want any of that, the app hands you to GitHub, which is
better at it.
```
~1,620 / 4000. **Note the one deliberate difference from the iOS description:**
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

**Captured 2026-10-18**, Pixel 8 emulator, 1080 x 2400 — `playstore/phone/`:
`01-feed.png`, `02-feed-scrolled.png`, `03-signin.png`. Play accepts these as-is.

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
| Data types collected | **Personal info → Email address, Name**; **App activity → none**; **Device or other IDs → none** |
| Is a User ID collected? | **Yes** — Personal info → User IDs |
| Is any of it *shared* with third parties? | **No** |
| Is data encrypted in transit? | **Yes** — all API calls are HTTPS to `repoherald.com` |
| Can users request data deletion? | **Yes** — in-app, and the URL below |
| Account deletion URL | `https://repoherald.com/account` |
| Is data collection optional? | **Yes** — the feed works fully signed-out |
| Purpose for each type | **App functionality** only |

Play also requires a **publicly reachable account-deletion path for users who
have uninstalled the app**. The in-app route satisfies the in-app half; make
sure the web route at `/account` is reachable and documented, or Play will flag
it.

## Content rating (IARC questionnaire)

Answer **No** to every content category — violence, sexuality, language,
controlled substances, gambling, horror. Two that need thought:

- **"Does the app allow users to interact or exchange content?"** — **No.** The
  app is read-only; comments and lists exist on the website, not in this binary.
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

1. **`mobile/play-service-account.json` is absent.** `eas.json` expects it and
   it is gitignored. Create a service account in Google Cloud for the Play
   Developer API, grant it release permissions in Play Console, download the
   JSON and put it there. This is the Android equivalent of the missing
   `AuthKey_*.p8`.
2. **No EAS project linked** — the same `eas init` step that blocks iOS
   (`SUBMISSION.md` step 3). One `init` covers both platforms.
3. **`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` for the production environment** — the
   same `pk_live_` key, same blocker as iOS. Clerk's **Native applications**
   entry must also allowlist the Android package `com.dekisuki05.repoherald`
   and the `repoherald://sso-callback` redirect.
4. **Deploy the web app.** Identical to iOS: `DELETE /api/mobile/v1/me` is 405
   in production and `/session` still expects a GitHub token, so sign-in and
   deletion are both broken against live. Play's review is lighter than
   Apple's, but shipping a broken sign-in is still shipping a broken sign-in.
5. **Play App Signing** — accept it when prompted. It is effectively mandatory
   for new apps and lets Google re-sign; EAS handles the upload key.

### Not a blocker, but do it once

Play requires new apps to target a recent API level. Expo SDK 57 / React Native
0.86 targets API 36, which satisfies the current requirement — confirm in the
generated `android/app/build.gradle` after `expo prebuild -p android` rather
than taking this on trust, since the floor rises every August.
