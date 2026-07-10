"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

/** Quick light/dark switch in the nav chrome. Flips to the neutral light or
 * dark theme based on the current theme's mode; the full theme palette is
 * chosen in account settings. */
export function ModeToggle() {
  const { theme, setThemeId } = useTheme();
  const isDark = theme.mode === "dark";

  return (
    <button
      type="button"
      className="rh-themebtn"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setThemeId(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
    </button>
  );
}
