"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  DEFAULT_THEME_ID,
  getTheme,
  htmlThemeAttrs,
  isThemeId,
  THEMES,
  THEME_COOKIE,
  THEME_STORAGE_KEY,
  writeThemeCookie,
  type Theme,
} from "@/lib/themes";

type ThemeContextValue = {
  theme: Theme;
  themeId: string;
  setThemeId: (id: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Apply a theme to <html>: swap the theme-* class, toggle the base .dark
 * variant, and set data-theme (which the nav chrome's rh-* tokens read). */
function applyTheme(id: string) {
  const { className, dataTheme } = htmlThemeAttrs(id);
  const root = document.documentElement;
  for (const t of THEMES) root.classList.remove(`theme-${t.id}`);
  root.classList.remove("dark");
  for (const c of className.split(" ")) root.classList.add(c);
  root.setAttribute("data-theme", dataTheme);
}

/**
 * One-time migration for visitors who picked a theme while it lived in
 * localStorage. Runs at module scope — i.e. on the client before React renders
 * — rather than in an effect, so it corrects the DOM immediately and never
 * calls setState during an effect. Without it, everyone who had chosen a theme
 * would silently snap back to light on the deploy that moved the storage.
 */
let pendingMigration = false;

function migrateLegacyTheme() {
  let legacy: string | null = null;
  try {
    legacy = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return; // storage blocked — nothing to migrate
  }
  if (!legacy) return;
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  // An existing cookie is the newer, explicit choice and must win.
  if (!isThemeId(legacy) || document.cookie.includes(`${THEME_COOKIE}=`)) return;
  writeThemeCookie(legacy);
  applyTheme(legacy);
  pendingMigration = true;
}

if (typeof document !== "undefined") migrateLegacyTheme();

/**
 * The theme arrives from the server, read from the cookie in the root layout,
 * so the markup is already correct on first paint — no flash, and no
 * server/client disagreement to suppress.
 */
export function ThemeProvider({
  children,
  initialThemeId,
}: {
  children: React.ReactNode;
  initialThemeId: string;
}) {
  const [themeId, setThemeIdState] = useState(initialThemeId);

  const setThemeId = useCallback((id: string) => {
    if (!isThemeId(id)) return;
    setThemeIdState(id);
    applyTheme(id);
    writeThemeCookie(id);
  }, []);

  // If the module-scope migration adopted a legacy theme, the server render we
  // hydrated from predates the cookie. Refresh so the server becomes the source
  // of truth again. Guarded, so this cannot loop.
  const router = useRouter();
  useEffect(() => {
    if (!pendingMigration) return;
    pendingMigration = false;
    router.refresh();
  }, [router]);

  // Keep other tabs in step. The cookie is shared, but a tab that is already
  // open will not notice it changed, so mirror the change through a storage
  // ping the way the old implementation did.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "rh_theme_sync" && e.newValue && isThemeId(e.newValue)) {
        setThemeIdState(e.newValue);
        applyTheme(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setAndBroadcast = useCallback(
    (id: string) => {
      setThemeId(id);
      try {
        localStorage.setItem("rh_theme_sync", id);
      } catch {
        /* cross-tab sync is a nicety, not a requirement */
      }
    },
    [setThemeId]
  );

  return (
    <ThemeContext.Provider
      value={{ theme: getTheme(themeId), themeId, setThemeId: setAndBroadcast }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

export { DEFAULT_THEME_ID };
