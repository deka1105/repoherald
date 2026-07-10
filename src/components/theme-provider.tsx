"use client";

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Starts at the default so SSR and first client render match; the inline
  // head script has already applied the stored theme's classes pre-paint, and
  // the mount effect below aligns React state with it.
  const [themeId, setId] = useState<string>(DEFAULT_THEME_ID);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && isThemeId(stored)) setId(stored);
  }, []);

  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  const setThemeId = useCallback((id: string) => {
    if (!isThemeId(id)) return;
    setId(id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // storage unavailable (private mode) — theme still applies for the session
    }
    applyTheme(id);
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

/** Blocking <head> script that applies the persisted theme before first paint,
 * so there's no flash of the default theme on load. Kept dependency-free and
 * generated from THEMES so it can't drift from the registry. */
export function themeInitScript(): string {
  const ids = THEMES.map((t) => t.id);
  const modes = Object.fromEntries(THEMES.map((t) => [t.id, t.mode]));
  return (
    `(function(){try{` +
    `var ids=${JSON.stringify(ids)},modes=${JSON.stringify(modes)};` +
    `var id=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
    `if(!id||ids.indexOf(id)===-1)id=${JSON.stringify(DEFAULT_THEME_ID)};` +
    `var r=document.documentElement;` +
    `ids.forEach(function(t){r.classList.remove('theme-'+t)});` +
    `r.classList.add('theme-'+id);` +
    `r.classList.toggle('dark',modes[id]==='dark');` +
    `r.setAttribute('data-theme',modes[id]);` +
    `}catch(e){}})();`
  );
}
