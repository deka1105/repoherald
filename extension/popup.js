const api = globalThis.browser ?? globalThis.chrome;

// Same single source of truth as the other scripts: the manifest.
const ORIGIN = (api.runtime.getManifest().host_permissions?.[0] ?? "").replace(/\/\*$/, "");
document.getElementById("site").href = ORIGIN;
document.getElementById("privacy").href = `${ORIGIN}/privacy`;

// "Dismissed" is per repository, so undoing means clearing those keys only —
// deliberately not the cached catalogue, which is expensive to refetch.
document.getElementById("reset").addEventListener("click", async () => {
  const all = await api.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("dismissed:"));
  if (keys.length) await api.storage.local.remove(keys);
  document.getElementById("status").textContent =
    keys.length ? `Restored ${keys.length} card${keys.length === 1 ? "" : "s"}.` : "Nothing was dismissed.";
});
