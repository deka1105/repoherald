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
| Phone screenshots | 2–8, min 320px, 16:9 or 9:16 | Pixel 8 captures, see below |
| 7" tablet | optional but recommended | — |
| 10" tablet | optional but recommended | reuse the iPad composition |

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
