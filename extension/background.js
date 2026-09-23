// Background worker: keeps a local copy of repoherald's listed-repo catalogue.
//
// The whole point of caching it is privacy. The naive design asks the server
// "is this repo listed?" on every GitHub page, which would send repoherald a
// running log of everything the user browses. Instead we pull the public list
// on a timer and answer locally, so browsing GitHub produces no network traffic
// to repoherald at all.

const api = globalThis.browser ?? globalThis.chrome;

// Derived from the manifest so the origin lives in exactly one place. Changing
// deployment target means editing host_permissions and nothing else — the
// previous version hardcoded it here too, which is three places to forget.
const ORIGIN = originFromManifest();
const CATALOG_URL = `${ORIGIN}/api/extension/catalog`;

function originFromManifest() {
  const pattern = api.runtime.getManifest().host_permissions?.[0] ?? "";
  return pattern.replace(/\/\*$/, "");
}
const STORE_KEY = "catalog";
const ALARM = "refresh-catalog";
const REFRESH_MINUTES = 180;

async function refreshCatalog() {
  try {
    const res = await fetch(CATALOG_URL, { credentials: "omit" });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data.repos)) return;
    await api.storage.local.set({
      [STORE_KEY]: { repos: data.repos, fetchedAt: Date.now() },
    });
  } catch {
    // Offline or blocked — keep whatever we already have. A stale catalogue
    // degrades to "we think this isn't listed", never to a broken page.
  }
}

api.runtime.onInstalled.addListener(() => {
  refreshCatalog();
  api.alarms.create(ALARM, { periodInMinutes: REFRESH_MINUTES });
});

api.runtime.onStartup?.addListener(refreshCatalog);

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) refreshCatalog();
});

// The content script asks for a refresh when its cached copy looks too old.
api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "refresh-catalog") {
    refreshCatalog().then(() => sendResponse({ ok: true }));
    return true; // keep the channel open for the async reply
  }
  return false;
});
