// Selectable design themes. Each theme sets the shadcn design tokens for the
// main app content (see the .theme-* classes in globals.css) and carries a
// light/dark `mode` that drives the nav chrome (rh-* tokens key off
// data-theme) and the base `.dark` variant. Swatches are shown in the picker.

export type ThemeMode = "light" | "dark";

export type Theme = {
  id: string;
  label: string;
  mode: ThemeMode;
  swatch: { bg: string; primary: string };
};

export const THEMES: Theme[] = [
  { id: "light", label: "Light", mode: "light", swatch: { bg: "#ffffff", primary: "#1a1a1a" } },
  { id: "dark", label: "Dark", mode: "dark", swatch: { bg: "#1f1f1f", primary: "#ededed" } },
  { id: "emerald", label: "Emerald", mode: "light", swatch: { bg: "#ffffff", primary: "#0f9d6b" } },
  { id: "rose", label: "Rose", mode: "light", swatch: { bg: "#ffffff", primary: "#e11d6b" } },
  { id: "ocean", label: "Ocean", mode: "dark", swatch: { bg: "#132033", primary: "#4c93ff" } },
  { id: "violet", label: "Violet", mode: "dark", swatch: { bg: "#1e1430", primary: "#a970ff" } },
];

export const DEFAULT_THEME_ID = "light";

/**
 * The theme lives in a COOKIE, not localStorage, so the server can render the
 * right theme on the first byte. With localStorage the server had no idea what
 * the visitor picked, so every page shipped the default and a blocking <head>
 * script repainted it before paint — workable, but it meant the markup and the
 * real theme disagreed, which is why <html> needed suppressHydrationWarning.
 * Same reasoning as rh_feed_layout.
 */
export const THEME_COOKIE = "rh_theme";
/** Legacy localStorage key, read once to migrate existing visitors. */
export const THEME_STORAGE_KEY = "rh_theme";
/** A year; it is a preference, not a session. */
export const THEME_COOKIE_MAX_AGE = 31_536_000;

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function isThemeId(id: string | null | undefined): boolean {
  return THEMES.some((t) => t.id === id);
}

/** Cookie value -> a theme id we trust. Anything unknown falls back. */
export function parseThemeId(value: string | null | undefined): string {
  return isThemeId(value) ? (value as string) : DEFAULT_THEME_ID;
}

/**
 * The <html> attributes for a theme. One definition used by the server render
 * and by the client when applying a change, so the two cannot drift.
 */
export function htmlThemeAttrs(id: string): { className: string; dataTheme: ThemeMode } {
  const theme = getTheme(id);
  return {
    className: `theme-${theme.id}${theme.mode === "dark" ? " dark" : ""}`,
    dataTheme: theme.mode,
  };
}

/** Write the theme cookie from the client. Lax is right: a theme arriving on a
 *  cross-site navigation should still apply. Not HttpOnly — the client sets it. */
export function writeThemeCookie(id: string) {
  document.cookie = `${THEME_COOKIE}=${id}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Retired. The server now renders the correct theme classes on <html> from the
 * cookie, so there is nothing to repaint before first paint. Kept out rather
 * than left dead — see ThemeProvider for the one-time localStorage migration.
 */
