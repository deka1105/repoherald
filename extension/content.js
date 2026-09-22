// Injects the repoherald card on GitHub repository pages.
//
// Two rules shape this file:
//  1. No network call to repoherald just because you visited a page. The
//     listed/not-listed answer comes from the locally cached catalogue. We only
//     fetch details for a repo the catalogue already says is public on the feed.
//  2. Never fight GitHub's own UI. The card lives in a shadow root so GitHub's
//     stylesheet cannot leak in and ours cannot leak out, and it is dismissible.

const api = globalThis.browser ?? globalThis.chrome;

const ORIGIN = "https://repoherald.com";
const STORE_KEY = "catalog";
const DISMISS_PREFIX = "dismissed:";
const STALE_MS = 6 * 60 * 60 * 1000;

/** owner/name for a repo page, or null for every other GitHub page. */
function repoFromPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [owner, name] = parts;
  // Reserved roots that look like owners but are not.
  const reserved = new Set([
    "settings", "notifications", "explore", "marketplace", "pulls", "issues",
    "codespaces", "sponsors", "orgs", "topics", "trending", "collections",
    "events", "about", "pricing", "features", "enterprise", "team", "login",
    "join", "new", "organizations", "dashboard", "search", "apps",
  ]);
  if (reserved.has(owner.toLowerCase())) return null;
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(name)) return null;
  // Strip a trailing .git if someone lands on the clone URL.
  return `${owner}/${name.replace(/\.git$/, "")}`.toLowerCase();
}

async function getCatalog() {
  const stored = await api.storage.local.get(STORE_KEY);
  const entry = stored?.[STORE_KEY];
  if (!entry) {
    api.runtime.sendMessage({ type: "refresh-catalog" }).catch(() => {});
    return null;
  }
  if (Date.now() - (entry.fetchedAt ?? 0) > STALE_MS) {
    // Refresh in the background; answer from the stale copy meanwhile.
    api.runtime.sendMessage({ type: "refresh-catalog" }).catch(() => {});
  }
  return entry.repos ?? null;
}

async function isDismissed(fullName) {
  const key = DISMISS_PREFIX + fullName;
  const stored = await api.storage.local.get(key);
  return Boolean(stored?.[key]);
}

async function dismiss(fullName) {
  await api.storage.local.set({ [DISMISS_PREFIX + fullName]: Date.now() });
}

/** Details for a repo we already know is listed. */
async function fetchDetail(fullName) {
  try {
    const res = await fetch(
      `${ORIGIN}/api/extension/repo?full_name=${encodeURIComponent(fullName)}`,
      { credentials: "omit" }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const HOST_ID = "repoherald-card-host";

function removeCard() {
  document.getElementById(HOST_ID)?.remove();
}

function renderCard({ fullName, listed, detail }) {
  removeCard();

  const host = document.createElement("div");
  host.id = HOST_ID;
  // Shadow DOM: GitHub's CSS is extensive and changes often. Isolation is the
  // only way this stays readable across their redesigns.
  const root = host.attachShadow({ mode: "open" });

  const wrap = document.createElement("div");
  wrap.className = "rh-card";
  wrap.setAttribute("role", "complementary");
  wrap.setAttribute("aria-label", "repoherald");

  const repoUrl = detail?.repo?.url ? ORIGIN + detail.repo.url : null;
  const postUrl = `${ORIGIN}/post?url=${encodeURIComponent("https://github.com/" + fullName)}`;

  wrap.innerHTML = `
    <div class="rh-head">
      <span class="rh-mark">repoherald</span>
      <button class="rh-x" type="button" aria-label="Dismiss for this repository">&times;</button>
    </div>
    ${
      listed
        ? `<p class="rh-title">Listed on repoherald</p>
           <p class="rh-meta">
             ${detail?.repo ? `${detail.repo.starsClaimed} star${detail.repo.starsClaimed === 1 ? "" : "s"} claimed here` : "Already posted"}
             ${detail?.repo?.highlighted ? ` &middot; <span class="rh-badge">highlighted</span>` : ""}
             ${detail?.repo?.sponsored ? ` &middot; <span class="rh-badge">sponsored</span>` : ""}
           </p>
           <a class="rh-btn" href="${repoUrl ?? ORIGIN}" target="_blank" rel="noopener noreferrer">View listing &amp; star it</a>`
        : `<p class="rh-title">Not on repoherald yet</p>
           <p class="rh-meta">Post it so people can find and star it. You'll need to own the repo, or belong to the org.</p>
           <a class="rh-btn" href="${postUrl}" target="_blank" rel="noopener noreferrer">Post this repo</a>`
    }
  `;

  root.appendChild(wrap);
  const style = document.createElement("style");
  style.textContent = CARD_CSS;
  root.appendChild(style);

  wrap.querySelector(".rh-x")?.addEventListener("click", () => {
    dismiss(fullName);
    removeCard();
  });

  // Escape dismisses too, for anyone not using a mouse.
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      dismiss(fullName);
      removeCard();
    }
  });

  document.body.appendChild(host);
}

const CARD_CSS = `
  :host { all: initial; }
  .rh-card {
    position: fixed; top: 64px; right: 16px; z-index: 2147483000;
    width: 264px; box-sizing: border-box; padding: 12px 14px 14px;
    font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #ffffff; color: #1f2328;
    border: 1px solid #d1d9e0; border-radius: 10px;
    box-shadow: 0 8px 24px rgba(31, 35, 40, 0.12);
  }
  @media (prefers-color-scheme: dark) {
    .rh-card { background: #151b23; color: #f0f6fc; border-color: #3d444d;
               box-shadow: 0 8px 24px rgba(1, 4, 9, 0.6); }
  }
  .rh-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .rh-mark { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; opacity: .65; }
  .rh-x { background: none; border: 0; font-size: 18px; line-height: 1; cursor: pointer;
          color: inherit; opacity: .55; padding: 0 2px; border-radius: 4px; }
  .rh-x:hover { opacity: 1; }
  .rh-x:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; opacity: 1; }
  .rh-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
  .rh-meta { margin: 0 0 10px; opacity: .8; }
  .rh-badge { display: inline-block; padding: 0 6px; border-radius: 999px;
              background: rgba(31,35,40,.08); font-size: 11px; }
  @media (prefers-color-scheme: dark) { .rh-badge { background: rgba(240,246,252,.12); } }
  .rh-btn { display: block; text-align: center; padding: 7px 10px; border-radius: 6px;
            background: #1f883d; color: #ffffff; text-decoration: none; font-weight: 600; }
  .rh-btn:hover { background: #1a7f37; }
  .rh-btn:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  @media (prefers-reduced-motion: no-preference) {
    .rh-card { animation: rh-in .18s ease-out; }
    @keyframes rh-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  }
`;

let lastPath = null;

async function run() {
  const path = location.pathname;
  if (path === lastPath) return;
  lastPath = path;

  const fullName = repoFromPath(path);
  if (!fullName) return removeCard();
  if (await isDismissed(fullName)) return removeCard();

  const catalog = await getCatalog();
  // No catalogue yet (first run, offline): say nothing rather than guess wrong.
  if (!catalog) return removeCard();

  const listed = catalog.includes(fullName);
  const detail = listed ? await fetchDetail(fullName) : null;
  renderCard({ fullName, listed, detail });
}

// GitHub is a single-page app: it swaps content without a full navigation, so
// a one-shot script would only ever fire on a hard load. Watch for URL changes.
function watchNavigation() {
  run();
  let href = location.href;
  const check = () => {
    if (location.href !== href) {
      href = location.href;
      run();
    }
  };
  // Their soft navigations fire these; the observer is the safety net.
  document.addEventListener("turbo:load", check);
  document.addEventListener("pjax:end", check);
  window.addEventListener("popstate", check);
  new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
}

watchNavigation();
