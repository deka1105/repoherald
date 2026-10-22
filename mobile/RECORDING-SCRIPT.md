# Screen recording script — Guideline 2.1 reply

Physical device, latest iOS, one continuous take if you can. Target 75–95s.
Every label below is the exact string in the build, so you can follow it live.

**Before you start**
- Install the build from TestFlight (build 6 or later — build 5 is missing the
  signed-out route into Account).
- Sign out if you are signed in. The recording must start signed out, because
  that is the point of steps 3–6.
- If you have blocked anyone during testing, unblock them first so the feed is
  full: `•••` in the header → Blocked accounts → Unblock.
- Silence notifications. Do not start from the app already open.

---

## 1 · Launch — 8s

Start on the home screen. Tap the repoherald icon.

Let the splash resolve on its own. **Do not scroll yet** — hold about two
seconds on the first painted frame so it is obvious the feed is already
populated and nothing asked you to sign in.

> Shows: no registration wall, no onboarding, no email gate.

## 2 · Browse and open a repo — 15s

Scroll down two or three cards at reading speed, then back up.

Tap any card. Safari opens that repository on github.com. Wait until the page
has visibly loaded, then return to the app with the back affordance.

> Shows: the core loop — the app hands you to GitHub, it is not a GitHub client.

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

Tap `•••` in the **header**, to the left of Sign in.

The Account sheet opens. Scroll to **Blocked accounts** — the owner you just
blocked is listed.

Tap **Unblock** next to it. The row disappears.

Tap **Done**, and let the feed show the card is back.

> Shows: blocking is reversible, not a trap, and reachable without an account.

## 6 · Sign in — 15s

Tap **Sign in** in the header.

Tap **Continue with Apple**. Complete the Apple sheet.

You land back on the feed with a credit balance where Sign in used to be.

> Shows: registration/login. Apple's item 1 asks for this explicitly.

## 7 · Account and deletion — 15s

Tap the credit balance to open Account.

Let **Credits** and **Can earn credits** be visible for a second.

Scroll to **Danger zone**. Tap **Delete my account**.

On the confirm dialog, tap **Delete permanently**.

> Shows: account deletion from inside the app, Guideline 5.1.1(v).
> Apple requires this whenever an app supports account creation.

## 8 · Land signed out — 5s

The app returns to the feed, signed out, still working.

End the recording here.

---

## What each Apple requirement maps to

| Apple asked for | Step |
|---|---|
| Begins with launching the app | 1 |
| Typical user flow | 1–2 |
| Account registration and login | 6 |
| Account deletion | 7 |
| User-generated content | 2 |
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
