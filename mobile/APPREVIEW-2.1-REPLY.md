# Reply draft — Guideline 2.1, Information Needed (new submission)

Paste items 2–6 into **both** the App Store Connect reply **and** the Notes field
of App Review Information, as Apple asked. Item 1 is a recording only you can make.

---

## 1. Screen recording

Physical device, latest iOS, starting from launch. Shot list:

1. Tap the icon on the home screen — show the launch, not a mid-session state.
2. The feed loads with **no sign-in wall**. Scroll a few cards.
3. Tap a card → it opens that repository on github.com in Safari. Come back.
4. **Tap the `...` control on any card** → Options → **Report this repo** → pick a
   reason → show the confirmation. (Do this while signed out, to show reporting
   does not require an account.)
5. Open `...` again → **Block <owner>** → show the card disappearing from the feed.
6. Tap the account control → **Sign in** sheet → *Continue with Apple*. Complete it.
7. In the account sheet, show **Blocked accounts** and tap **Unblock** — blocking
   is reversible.
8. Show Credits and the balance.
9. Tap **Delete my account** → the confirm dialog → **Delete permanently**.
10. Show that the app returns to the signed-out feed, which still works.

Keep it one continuous take if you can. Apple asked for the typical user flow, and
registration / login / deletion are explicitly required.

Build 5 added reporting and blocking; steps 4, 5 and 7 are the Guideline 1.2
mechanisms Apple asked to see.

---

## 2. Purpose and target audience

repoherald is a read-only feed of public GitHub repositories that people have
posted because they thought someone else should see them.

The audience is software developers and technically-minded readers who want to
find open-source projects worth their time.

The problem it solves: finding a genuinely useful repository is mostly luck.
GitHub's trending page rewards what is already enormous, and social feeds reward
whoever already has an audience. repoherald is smaller than both and shows
projects a person deliberately chose to put in front of other people.

The value: a short, human-curated feed that requires no account to read, applies
no ranking algorithm, and collects no usage data.

## 3. Setup and access instructions

**No credentials are required to review the app.** Launch it and the feed loads
immediately — there is no onboarding, no registration wall and no email gate.
Tap any card to open that repository on github.com.

Signing in is entirely optional and changes nothing about browsing. It exists so
a signed-in user can earn credits by starring repositories on their own GitHub
account.

We cannot supply a fixed demo account because sign-in is delegated entirely to
Apple, GitHub and Google; there are no app-specific passwords to issue. To test
the signed-in state, please use **Continue with Apple** with any Apple ID — that
path requires nothing from us and creates the account on first use.

Account deletion (required, and present in this build): account control in the
top right → **Delete my account** → confirm **Delete permanently**. It deletes
the profile and the GitHub connection and hides the user's posts. There is no
email to send and no web form to fill in.

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

No payment processor is reachable from the iOS app. Credits can only be earned,
never purchased, inside the app, and the app does not link to any purchase flow.

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
  account. Blocks are stored on the device and are reversible from
  Account → Blocked accounts.

Builds 1–4 had neither. Build 5, submitted with this reply, adds both.
