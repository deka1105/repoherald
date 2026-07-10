"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_THEME_ID,
  getTheme,
  isThemeId,
  THEME_STORAGE_KEY,
  THEMES,
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
  const theme = getTheme(id);
  const root = document.documentElement;
  for (const t of THEMES) root.classList.remove(`theme-${t.id}`);
  root.classList.add(`theme-${theme.id}`);
  root.classList.toggle("dark", theme.mode === "dark");
  root.setAttribute("data-theme", theme.mode);
}

// localStorage is the source of truth (same pattern as the landing/welcome-guide
// panels). Same-tab writes notify via a local listener set; cross-tab writes via
// the native `storage` event.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): string {
  const id = localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeId(id) ? (id as string) : DEFAULT_THEME_ID;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Server render (and hydration's first pass) uses the default; the inline
  // head script has already painted the stored theme, and this re-renders to it.
  const themeId = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_THEME_ID);

  // Keep <html> in sync with the current value (covers cross-tab changes too).
  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  const setThemeId = useCallback((id: string) => {
    if (!isThemeId(id)) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // storage unavailable (private mode) — apply for the session anyway
    }
    applyTheme(id);
    for (const l of listeners) l();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: getTheme(themeId), themeId, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
