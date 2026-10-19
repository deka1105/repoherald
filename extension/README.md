# repoherald for GitHub

Shows whether the GitHub repository you're viewing is listed on
[repoherald](https://repoherald.com), and lets you post it if it isn't.

## The privacy decision

The obvious way to build this is to ask the server *"is github.com/x/y listed?"*
on every GitHub page. That would send repoherald a running log of every
repository each user browses — cross-site tracking, and the exact thing
repoherald's privacy policy promises not to do.

So the extension works **local-first**:

1. Every few hours it downloads `/api/extension/catalog` — the public list of
   listed repositories, identical for everyone.
2. It answers listed / not-listed **on your machine**, with no network call.
3. It only fetches details (`/api/extension/repo`) for a repository the list
   already says is public on the feed.

Browsing GitHub therefore produces **no traffic to repoherald at all**. Requests
are sent with `credentials: "omit"`, so no cookie or account identifier rides
along, and the server does not record them as page views.

## Pointing it at a different origin

**Set to `https://repoherald.com`** since 2026-10-18. It previously pointed at
`https://repoherald.vercel.app`, because the real domain's DNS was still on
registrar parking. That is no longer true — `repoherald.com` serves the catalog
with a 200, and the old hostname now answers **308** redirecting to it.

That redirect is why this had to change rather than merely being tidier. A
Manifest V3 fetch is permitted against the hosts in `host_permissions`; when the
response redirects to an origin that is *not* listed, the request is blocked. So
the catalog fetch failed, the extension never learned which repositories were
listed, and it silently did nothing.

The origin is defined in **exactly one place**: `host_permissions` in
`manifest.json`. `background.js`, `content.js`, and `popup.js` all derive it at
runtime from `runtime.getManifest()`, so pointing the extension somewhere else
is still a one-line edit.

## Install (development)

**Chrome** — `chrome://extensions` → enable Developer mode → *Load unpacked* →
select this directory.

**Firefox** — `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on*
→ select `manifest.json`.

One manifest serves both: Chrome reads `background.service_worker`, Firefox
reads `background.scripts`, and each ignores the other's key.

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3, cross-browser |
| `background.js` | Refreshes and caches the catalogue on an alarm |
| `content.js` | Detects repo pages, renders the card in a shadow root |
| `content.css` | Intentionally empty — styling lives in the shadow root |
| `popup.html` / `popup.js` | Toolbar popup; restores dismissed cards |

## Notes for whoever picks this up

- **The card lives in a shadow root.** GitHub's stylesheet is large and changes
  often; isolation is why this survives their redesigns. Don't move the styles
  into `content.css`.
- **GitHub is a single-page app.** A one-shot content script only fires on hard
  loads, so `watchNavigation()` listens for `turbo:load`, `pjax:end`, and
  `popstate`, with a MutationObserver as the safety net.
- **Posting requires ownership.** `postRepo` only accepts repos you own or whose
  org you belong to, so the card says so rather than implying anyone can post
  anything. The link prefills `/post?url=…`, which the page validates against a
  strict `github.com/owner/name` pattern before filling the field.
- **A stale catalogue fails safe**: it degrades to "not listed", never to a
  broken page. If there's no catalogue at all, the card doesn't render.

## Before publishing to the stores

- Replace `icons/` — these are resized from the site shield and are placeholders.
- Both stores require a privacy policy URL: use `<origin>/privacy`,
  which documents the extension's data flow.
- Bump `version` in `manifest.json` for each store submission.
