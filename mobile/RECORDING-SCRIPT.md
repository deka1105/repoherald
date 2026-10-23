# Screen recording script — Guideline 2.1 reply

Physical device, latest iOS, one continuous take if you can. Target 110–130s.
Every label below is the exact string in the build, so you can follow it live.

**Rewritten 2026-10-23** for the six-tab build. The previous script was written
when the app was a single feed: it told you to tap `•••` *in the header* and
said a card tap opens Safari. Neither is true any more — Account is a tab, and
a card opens the repo screen.

**Before you start**
- Install **build 9 or later** from TestFlight. Anything earlier is the
  single-screen app and does not match this script or the listing.
- Sign out if you are signed in. The recording must start signed out, because
  that is the point of steps 3–5.
- Make sure the demo account has **one list with two or three repos in it**,
  so steps 7–8 are not empty screens. Do that before you start recording.
- If you have blocked anyone during testing, unblock them first so the feed is
  full: **Account** tab → Blocked accounts → Unblock.
- Silence notifications. Do not start from the app already open.

---

## 1 · Launch — 8s

Start on the home screen. Tap the repoherald icon.

Let the splash resolve on its own. **Do not scroll yet** — hold about two
seconds on the first painted frame so it is obvious the feed is already
populated and nothing asked you to sign in.

> Shows: no registration wall, no onboarding, no email gate.

## 2 · Browse, open a repo, go to GitHub — 18s

Scroll down two or three cards at reading speed, then back up.

Tap any card. **The repo screen opens** — description, stars, language, who
posted it, categories, comments.

Tap **View on GitHub**. Safari opens that repository. Wait until the page has
visibly loaded, then return to the app, and use the back arrow to return to
Explore.

> Shows: the core loop, and that the app is native throughout — not a WebView —
> while still handing you to GitHub for the code itself.

## 3 · Report, while still signed out — 20s

Tap the `•••` control on the right of any card.
*(A long-press on the card does the same thing — but tap the control, it is
clearer on video.)*

The **Options** sheet opens. Pause a beat so the two choices are legible.

Tap **Report this repo**.

Under **What is wrong with it?** tap **Spam or scam**.

Wait for the confirmation: *"Thank you. A moderator will look at this
listing…"*. Hold two seconds.

Tap **Done**.

> Shows: reporting exists, takes a reason, and works with no account.
> This is the Guideline 1.2 mechanism. Do not sign in before this step.

## 4 · Block — 15s

Tap `•••` on the **same card** again.

Tap **Block \<owner\>** (the red one — it names the actual account).

Wait for *"Blocked. Nothing from \<owner\> will appear in your feed…"*.

Tap **Done**.

**Let the camera rest on the feed for two seconds** — that card is now gone.
This is the proof the block took effect, so do not rush past it.

> Shows: blocking exists and visibly works.

## 5 · Unblock — 12s

Tap the **Account** tab (rightmost, person icon).

Scroll to **Blocked accounts** — the owner you just blocked is listed.

Tap **Unblock** next to it. The row disappears.

Go back to **Explore** and let the feed show the card is back.

> Shows: blocking is reversible, not a trap, and reachable without an account.

## 6 · Sign in — 15s

Back on the **Account** tab, tap **Sign in**.

Tap **Continue with Apple**. Complete the Apple sheet.

You land back on Account with your name, handle and a credit balance.

> Shows: registration/login. Apple's item 1 asks for this explicitly.

## 7 · Search, including your own lists — 15s

Tap the **Search** tab. Type a word that matches something in your list
(for example part of a repo name you saved).

Hold two seconds on the results: the **In your lists** heading above your own
saved repos, and **On repoherald** below it.

> Shows: the app's second purpose — finding something you already saved — and
> that signed-in search is more than the public feed.

## 8 · Lists — 12s

Tap the **Lists** tab. Tap your list.

Scroll it once. Tap one repo to open it, then come back.

> Shows: user-generated organisation, and that the list screens are real.

## 9 · Comment — 12s

From the repo screen, scroll to the comment box. Type a short sentence and tap
**Post comment**. Let it appear in the list below.

> Shows: user-generated *content*, which is what Guideline 1.2 is really about.
> Having shown reporting and blocking in steps 3–5, this closes the loop.

## 10 · Wallet — 8s

Tap the **Wallet** tab. Hold two seconds on the balance, the claim counters
and the history rows.

> Shows: credits are earned, tracked and visible. **Nothing is for sale here —
> there is no purchase control anywhere in the app.**

## 11 · Account deletion — 15s

Tap the **Account** tab. Scroll to **Danger zone**.

Tap **Delete my account**. On the confirm dialog, tap **Delete permanently**.

> Shows: account deletion from inside the app, Guideline 5.1.1(v).
> Apple requires this whenever an app supports account creation.

## 12 · Land signed out — 5s

The app returns to the feed, signed out, still working.

End the recording here.

---

## What each Apple requirement maps to

| Apple asked for | Step |
|---|---|
| Begins with launching the app | 1 |
| Typical user flow | 1–2, 7–10 |
| Account registration and login | 6 |
| Account deletion | 11 |
| User-generated content | 2, 8, 9 |
| Content reporting mechanism | 3 |
| Blocking mechanism | 4–5 |
| Accessing paid content | n/a — nothing is sold in the app |

## Things that will cost you a round

- **Do not sign in before step 3.** Reporting while signed out is the strongest
  single thing in the recording.
- **Do not cut between steps.** A continuous take is harder to argue with.
- **Do not skip the two-second rest in step 4.** If the blocked card vanishing
  is not visible, blocking is not demonstrated.
- **Do not record on a simulator.** Apple asked for a physical device and can
  tell.
- **Do not record step 11 before step 10.** Deleting the account signs you out,
  and the Wallet goes with it.
