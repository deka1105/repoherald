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
export const THEME_STORAGE_KEY = "rh_theme";

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function isThemeId(id: string | null | undefined): boolean {
  return THEMES.some((t) => t.id === id);
}
