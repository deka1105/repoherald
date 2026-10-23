# iOS submission checklist

State as of **2026-10-23 (build 9)**. Everything under **Done** is in the repo
and verified; everything under **Owner actions** needs an account, a key or a
human decision and cannot be done from the codebase.

## 2026-10-23 — the app caught up with the website

Build 6 and earlier were a single feed screen. Build 9 is the website's phone
experience, native throughout:

| Area | What changed |
|---|---|
| Navigation | Converted to **Expo Router**, as `mobile/AGENTS.md` has always prescribed. Routes under `mobile/src/app/`; six tabs — Explore, Search, Post, Lists, Wallet, Account — plus pushed screens for a repo, a list and support. `App.tsx` and `index.ts` are gone; `main` is `expo-router/entry`. |
| Search | `/api/mobile/v1/search`. Public listings plus repos in the caller's **own** lists, which is how a repo filed from a DM is findable by the person who sent it and nobody else. |
| Repo screen | `/api/mobile/v1/repos/[id]` returns the whole screen in one round trip: metadata, categories, view counts, like state, comments, claim state and caps. Plus like, comment, delete-own-comment, claim-a-star and add-to-list. |
| Posting | `/api/mobile/v1/repos` (POST), over the **shared** `src/lib/post-repo.ts` the web form now also calls — so the owner/org check cannot differ between clients. |
| Lists | Create, read, add by URL or id, remove an item, delete a list. Instagram/TikTok lists are labelled as such. |
| Wallet | Read-only: balance, eligibility, claim caps, your listings, the last 100 ledger entries. No spend, no purchase. |
| Support | `/api/mobile/v1/support`, open signed out, over the shared `src/lib/support-ticket.ts`. |
| Legal | Privacy, Terms, Cookies and Refunds open in an **in-app** browser from Account, rather than handing the person to Safari. |
| Shared server logic | `claimStar`, `postRepo` and `submitSupportTicket` were extracted into `src/lib/claim.ts`, `src/lib/post-repo.ts` and `src/lib/support-ticket.ts`. The web actions are now thin wrappers over the same functions, so web and mobile cannot drift on the rules that matter. |
| Build reliability | `mobile/AGENTS.md` now records the npm 10 lockfile trap that failed builds 7 and 8 — see that file before touching dependencies. |

Verified for build 9: `expo-doctor` 18/18, `tsc --noEmit` clean (app and
server), `expo lint` clean, `expo export` bundles iOS and Android, web
`npm run build` green, and the EAS production build for iOS finished.

**Still not verified:** the signed-in happy path on a device. Same caveat as
below — it needs a real account and, for deletion, a row you are willing to
destroy. Do it in TestFlight.

## Done

| Area | What changed |
|---|---|
| Account deletion | `AccountSheet` → `DELETE /api/mobile/v1/me` → `src/lib/account-deletion.ts`, the same purge the web runs. **Guideline 5.1.1(v)** blocker. |
| Login options | Sign-in moved from a hand-rolled GitHub OAuth to Clerk (`@clerk/expo`), so Apple, GitHub and Google are all available and identity is shared with the web. **Guideline 4.8.** |
| Privacy manifest | `ios.privacyManifests` in `app.json`, verified to generate a correct `PrivacyInfo.xcprivacy` (UserDefaults `CA92.1`, FileTimestamp `C617.1`/`0A2A.1`/`3B52.1`, DiskSpace `E174.1`/`85F4.1`, plus collected-data types). Missing entries here are the `ITMS-91053` upload rejection. |
| Config schema | Removed `android.edgeToEdgeEnabled` (not a valid SDK 57 key — it failed `expo-doctor`) and `ios.buildNumber`/`android.versionCode` (ignored under `appVersionSource: remote`). |
| Splash screen | `expo-splash-screen` plugin configured against the existing `assets/splash-icon.png`; previously there was none and launch was a blank screen. Held until the feed's first paint. |
| Dark mode | `userInterfaceStyle: "dark"` — the UI was always hardcoded dark, so system surfaces now match. `expo-system-ui` applies the root background. |
| iPad | Kept `supportsTablet: true`. Feed and sheets are capped to a 720pt reading column so the layout doesn't stretch; Expo enables all four orientations on tablet, which this handles. |
| Encryption | `ITSAppUsesNonExemptEncryption: false` confirmed in the generated `Info.plist` — skips the export-compliance questionnaire per upload. |
| API domain | `API_BASE` moved from `repoherald.vercel.app` to `repoherald.com`. The former 308-redirects to the latter, so every call was paying an extra round trip and relying on the `Authorization` header surviving an origin change. |
| **Feed card titles** | **Shipping bug, found 2026-10-18 by running the app.** `FeedRepo` in `src/api.ts` declared `name` and `ownerLogin`; `src/lib/feed.ts` has never sent either, and `request<T>` casts the response instead of validating it, so both were `undefined` and **every card in the feed rendered with no title**. `tsc` could not see it. The card now derives both halves from `fullName`. |
| Housekeeping | Clean dependency reinstall (duplicate `expo-constants` is gone), `react-dom` pinned to 19.2.3 to match SDK 57, and an ESLint config for the mobile app, which had none despite the root config deferring to it. |

Verified: `expo-doctor` 18/18, `tsc --noEmit` clean (app and server), `eslint`
clean, `expo prebuild -p ios` warning-free, web `npm run build` green, and the
mobile endpoints smoke-tested — public feed 200; `GET`/`DELETE /me` 401 without
a token, with a forged token, with a correctly-signed token for a non-existent
user, and with an expired one; `/session` 400 on a missing token and 401 on an
unverifiable Clerk token.

**Verified on a simulator 2026-10-18:** `expo run:ios` builds and launches on
iPhone 17 Pro Max (Xcode 26.5); the public feed loads live data from production
and renders correctly. This is how the missing-title bug above was found —
every gate was green while the app was visibly broken, because the only check
that fails on a lying cast is looking at it.

**Not verified:** the signed-in happy path (real sign-in, token exchange,
deletion of a real account). It needs a real Clerk account and, for deletion, a
row we are willing to destroy. Do it in TestFlight before submitting.

## Owner actions, in order

### 1. Clerk production instance
**`https://repoherald.com` is currently serving `pk_test_aW5jbHVk…`** — the live
website is pointed at a Clerk **development** instance, not just the local env.
Development instances use Clerk's shared OAuth credentials and are not intended
for end users, so this needs fixing for the website regardless of the app. A
shipped iOS app needs the production instance:

- Enable the **Apple**, **GitHub** and **Google** connections on it.
- **Native applications** → add this app: bundle ID `com.dekisuki05.repoherald`,
  Team ID / App ID Prefix `4LX3D498MB`.
- Allowlist the SSO redirect `repoherald://sso-callback` (mobile SSO allowlist).
- Copy the `pk_live_…` publishable key for step 3.

### 2. Sign in with Apple (Apple Developer portal)
- The App ID for `com.dekisuki05.repoherald` needs the **Sign In with Apple**
  capability. The entitlement itself is already generated by the
  `expo-apple-authentication` plugin — verified in the prebuilt
  `repoherald.entitlements`.
- The in-app flow is native, so it needs no Services ID. If you also want Apple
  sign-in to work through Clerk's hosted Account Portal, that path additionally
  needs a Services ID, key ID, private key and team ID in Clerk.
- Register an **Email Source** for Apple's private relay if you want Hide My
  Email to deliver mail.

### 3. Link the EAS project and set build env
`app.json` has no `owner` or `extra.eas.projectId` yet, and you are logged in to
two EAS accounts (`aryasoftech`, `aryasoftechs-team`) — pick deliberately:

```sh
cd mobile
npx eas-cli@latest init                      # writes owner + projectId
npx eas-cli@latest env:create --environment production \
  --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value pk_live_…
npx eas-cli@latest env:create --environment preview \
  --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value pk_test_…
```
A build whose environment lacks this key throws on launch with an explicit
message rather than shipping a silently broken sign-in — see `src/config.ts`.

### 4. Restore the App Store Connect API key
`eas.json` expects `mobile/AuthKey_UJ39YTD9H2.p8`, which is gitignored and not
on this machine. Put it back before `eas submit`.

### 5. Deploy the web app first — measured, not assumed
Probed `https://repoherald.com` on 2026-10-17. **Production is running the old
code**, so none of the server side of this work is live yet:

| Probe | Response | Means |
|---|---|---|
| `POST /api/mobile/v1/session` with `{}` | `400 missing_access_token` | old GitHub-token route still live; the Clerk route is **not** deployed |
| `DELETE /api/mobile/v1/me` | `405` | the account-deletion endpoint is **not** deployed |
| `GET /api/mobile/v1/feed` | `200`, 13 items | unchanged, fine |

Local `main` is pushed and identical to `origin/main`, so the code is on GitHub
and simply has not been deployed — consistent with Vercel git auto-deploy being
dead on this project. Needs a manual `vercel --prod`.

Until that deploy lands, the app cannot sign anyone in: it sends a Clerk token
and the live route expects a GitHub one.

### 6. Build, test, submit
```sh
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production
```
In TestFlight, confirm: sign in with Apple, GitHub and Google; credits show;
**delete the account and confirm the app returns to signed-out and the same
account cannot be used again**; feed loads without an account.

## App Store Connect metadata

**App Privacy** — answer from the code, which collects only:

| Data | Linked to identity | Tracking | Purpose |
|---|---|---|---|
| Email address | Yes | No | App Functionality |
| Name | Yes | No | App Functionality |
| User ID | Yes | No | App Functionality |

Nothing else. The app ships no analytics or crash SDK and never calls the
website's view counter, so **Usage Data** and **Diagnostics** are *not
collected*, and the answer to tracking is **No**.

**URLs:** privacy `https://repoherald.com/privacy`, support
`https://repoherald.com/support`. Both verified 200 with no redirect.

**Screenshots:** iPhone 6.9" and iPad 13" are the required sets — confirm exact
pixel sizes in App Store Connect, since Apple revises them.

**Review notes** — draft, edit before sending:

> repoherald is a discovery feed for GitHub repositories, and a place to keep
> the ones you want to find again. Browsing, searching and reporting need no
> account; sign in to post a repo, keep lists, comment, or earn credits.
>
> Sign in with Apple is offered alongside GitHub and Google. GitHub is relevant
> because the app's purpose is crediting people for starring repositories, which
> is a GitHub action we verify with read-only scopes (`read:user`,
> `user:email`); we cannot write to repositories or star anything on a user's
> behalf.
>
> Credits can only be *earned* in the app — never purchased and never spent.
> The Wallet screen is read-only, there is no sponsorship or promotion screen
> in the binary, and the app does not link to any purchase flow.
>
> To delete an account: sign in, open the **Account** tab, then
> "Delete my account" under Danger zone, and confirm "Delete permanently".

## Open items, not blockers

- **The welcome credit is unreachable on the web.** `grantWelcomeCredit` was
  only ever called from the old GitHub-only mobile route, so web sign-ups have
  never received one and `credit-notifier.tsx` has UI that never fires. The
  mobile route still grants it on a genuinely new account (`AppUser.created`),
  so this migration changed nothing — but the web gap is real and is a credit
  economy decision, so it was left alone. One line in `provisionFromClerk`
  would close it.
- ~~`mobile/AGENTS.md` prescribes Expo Router with routes in `src/app/`, which
  this app has never used.~~ **Resolved 2026-10-23** — the app is on Expo
  Router, routes live in `mobile/src/app/`, and the sign-in and moderation
  sheets are mounted once at the root (`mobile/src/app-state.tsx`) rather than
  per screen.
- **Donating credits to highlight a repo is on the web only.** Spending was
  left out of the app along with buying, so the Wallet has one honest job. If
  spending ever lands in the app, re-read Guideline 3.1.1 first: earned credits
  are defensible, but a screen that mixes earned and purchased balance into one
  spend flow is the conversation worth avoiding.
- **Reporting an upstream GitHub issue for credit** (`/wallet` on the web) is
  not in the app — it needs an issue URL nobody is typing on a phone.
- `upsertGithubUser` is now dead code, marked `@deprecated` rather than deleted
  because it documents how the pre-Clerk rows were made.
