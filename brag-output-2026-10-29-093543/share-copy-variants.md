# Share copy variants

The canonical caption is `share-copy.txt`. These are per-destination cuts of it.
Every number here is measured (228 cases, baseline run first); do not round them.

## X / Twitter (short)

> You already found it. Find it again.
>
> repoherald takes the post you saved and works out which GitHub repo it was
> about — even when the name was only *spoken*, so the slash is a word and the
> hyphens are silent.
>
> Nemotron on Nebius Token Factory: 24.6% → 89.9%.

## LinkedIn

> Everyone has the folder: a few hundred saved posts about developer tools you
> meant to use, with no titles, no notes and no search.
>
> repoherald is the other half of it. Send the post instead of saving it, and it
> comes back as a repository you can search.
>
> The hard step is the one in the middle — *which repository is this post
> about?* — and until last week that step was a person reading captions by
> hand. It now runs on NVIDIA Nemotron, served by Nebius Token Factory: the
> fast tier on every post, the 550B deep tier only on the candidates GitHub has
> already rejected.
>
> Measured against a no-model baseline run first, so the number means
> something: 24.6% → 89.9% over 228 real cases, one wrong.
>
> The rule that makes it safe to automate is that Nemotron proposes and GitHub
> decides. Every candidate is checked against the real API, so it can tell you
> it doesn't know — it can't invent a repository to file in someone's list.

## Discord / dev channels

> Shipped the part of repoherald that reads a saved post and works out the repo
> behind it. Hardest input is a Whisper transcript, because punctuation inside
> a repo name gets *said out loud* — `yt-dlp/yt-dlp` arrives as "yt dlp slash yt
> dlp", slash spoken, hyphens not. Nemotron on Nebius Token Factory repairs it,
> GitHub confirms it, and anything GitHub rejects gets thrown away no matter how
> confident the model sounded. 24.6% → 89.9% on 228 cases.

## One line, for a thumbnail or a slide

> You already found it. Find it again.
