const api = globalThis.browser ?? globalThis.chrome;

// "Dismissed" is per repository, so undoing means clearing those keys only —
// deliberately not the cached catalogue, which is expensive to refetch.
document.getElementById("reset").addEventListener("click", async () => {
  const all = await api.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("dismissed:"));
  if (keys.length) await api.storage.local.remove(keys);
  document.getElementById("status").textContent =
    keys.length ? `Restored ${keys.length} card${keys.length === 1 ? "" : "s"}.` : "Nothing was dismissed.";
});
