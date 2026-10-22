# Share copy variants — repoherald

`share-copy.txt` holds the canonical caption. These are alternates.

## Apps (links to the App Store / Play listing)

**Shorter, numbers first**

> Shipped repoherald to both app stores.
>
> 15 dependencies. 0 analytics SDKs. 0 crash reporters. 0 advertising IDs.
>
> 16.5 MB. Delete your account from inside the app. There is nothing to opt
> out of, because there is nothing collecting.

**Longer (LinkedIn / Show HN)**

> repoherald is a feed of GitHub repositories that people posted because they
> thought someone should see them. Open it and the feed is there — no account,
> no onboarding, no email wall. Tap a card, it opens on GitHub.
>
> The part I'm proudest of doesn't show up in a screenshot: 15 runtime
> dependencies, no analytics SDK, no crash reporter, no advertising ID.
>
> "We don't track you" is easy to write on a landing page. It's harder when a
> reviewer can diff your manifest against your privacy declarations. Those
> matched, because there was nothing to reconcile.

## Web (links to repoherald.com — do NOT pair with store links)

The Instagram-saves angle is real on the web and absent from the mobile app.

> Your saved folder is full of repos you never opened.
>
> DM us a link — a reel, a post, something three months deep in a thread. A
> person looks up the repository behind it, catalogues what it is and what it's
> written in, and files it in a private list only you can open.
>
> Not an AI pipeline. A person. Nothing you send is published.

Pre-flight: `INGEST_INSTAGRAM` must be set in prod or the landing omits the
whole "DM us" block (`src/app/page.tsx:72`), and repoHeraldIG must be running
on the other machine — the copy promises "a person reads every one."
