# App Store Connect listing — repoherald iOS

Copy-paste fields for the App Store Connect listing. Everything here describes
what **this binary** actually does. It deliberately does **not** mention repo
lists, Instagram/TikTok ingest, sponsorship or buying credits: none of those are
in the iOS app, and Guideline 2.3.1 (accurate metadata) rejects a listing that
describes features the reviewer cannot find.

Character limits are Apple's; counts below are exact.

## Fields

| Field | Value | Count |
|---|---|---|
| **App Name** | `repoherald` | 10 / 30 |
| **Subtitle** | `A feed of GitHub projects` | 25 / 30 |
| **Primary category** | Developer Tools | — |
| **Secondary category** | Productivity | — |
| **Age rating** | 4+ (no objectionable content; see note below) | — |
| **Privacy Policy URL** | `https://repoherald.com/privacy` | verified 200 |
| **Support URL** | `https://repoherald.com/support` | verified 200 |
| **Marketing URL** | `https://repoherald.com` | verified 200 |
| **Copyright** | `2026 repoherald` | — |

### Keywords (100 char limit)

```
github,repos,repository,open source,developer,programming,code,oss,discover,projects,software,dev
```
97 / 100. No spaces after commas (Apple counts them). Does not repeat the app
name or subtitle words — Apple already indexes those, so repeating them wastes
the budget.

### Promotional text (170 chars, editable without a new build)

```
A quiet feed of GitHub repositories people actually wanted to show someone. Tap any project to open it on GitHub. No account needed to browse.
```
142 / 170.

### Description (4000 chars)

```
repoherald is a feed of GitHub repositories that people have posted because they
thought someone should see them.

Open the app and the feed is there. No account, no onboarding, no email wall.
Each card shows the project, who owns it, what language it is written in, its
star count and its description. Tap one and it opens on GitHub, where the code
actually lives.

WHAT IT IS FOR

Finding a library that is worth your afternoon is mostly luck. Trending pages
reward whatever is already enormous, and social feeds reward whoever already has
an audience. repoherald is smaller than both and tries to do something simpler:
show you projects that a human being chose to put in front of other people.

Pull to refresh. Scroll for more. That is the whole app.

IF YOU SIGN IN

Signing in is optional and changes nothing about browsing. It exists so you can
earn credits by starring repositories you genuinely like — the star is a real
GitHub action on your own account, and we verify it with read-only permissions.
We cannot write to your repositories, cannot star anything on your behalf, and
cannot see your private code.

You can sign in with Apple, GitHub or Google.

Credits can only be earned in this app. Nothing is sold here.

YOUR ACCOUNT, YOUR DECISION

You can delete your account from inside the app at any time — Credits, then
Delete my account. It removes your account and the data attached to it. There is
no email to send and no form to fill in.

The app ships no analytics SDK and no crash reporter. It does not track you
across apps or websites, and there is nothing to opt out of.

WHAT THIS APP IS NOT

It is not a GitHub client. You cannot open issues, review pull requests or read
code here. When you want any of that, the app hands you to GitHub, which is
better at it.
```
~1,740 / 4000.

### What's New

First release — leave blank. App Store Connect does not require release notes
for version 1.0.

## Age rating questionnaire

Answer **None** to every content question. One answer needs thought:

- **"Unrestricted Web Access"** — answer **No**. The app opens specific
  `github.com` repository URLs and three fixed policy pages via the system
  browser; there is no address bar and no in-app browser the user can navigate
  freely. (If App Review disagrees, the fallback is 17+, which would be
  unfortunate but not fatal.)

## App Privacy answers

From the code, the app collects only these three, all linked to identity, none
used for tracking, all for App Functionality:

| Data type | Linked | Tracking | Purpose |
|---|---|---|---|
| Email Address | Yes | No | App Functionality |
| Name | Yes | No | App Functionality |
| User ID | Yes | No | App Functionality |

**Usage Data: not collected. Diagnostics: not collected.** The app has no
analytics or crash SDK and never calls the website's view counter. Answer **No**
to "Do you or your third-party partners use data for tracking?"

These answers must match `ios.privacyManifests` in `app.json`. They do today —
if you change one, change both.

## Screenshots

Required sets: **iPhone 6.9"** (1320 × 2868) and **iPad 13"** (2064 × 2752).
Apple revises these; confirm in App Store Connect before uploading.

Shot list, in order — the first two are what most people ever see:

1. The feed, scrolled to the top, full of real repositories.
2. The feed mid-scroll, showing variety of language and project size.
3. The sign-in sheet, with Continue with Apple first.
4. The account sheet showing a credit balance.
5. The account sheet showing About and Danger zone, so review can see deletion
   is reachable without reading the notes.

Do not add marketing captions over screenshot 1. Apple's own reviewers and most
browsers judge the first shot in under a second; the bare UI reads as more
honest than a slogan on a gradient.

## Review notes

See `SUBMISSION.md` — the draft there is current. Two things it gets right that
are worth not losing: it explains *why* GitHub sign-in exists (Guideline 4.8
context), and it gives the exact tap path to account deletion, which is the
single most common reason a 5.1.1(v) check gets escalated.
