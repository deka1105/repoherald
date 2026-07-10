"use client";

import { Check } from "lucide-react";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/components/theme-provider";

/** Inline theme grid for the account settings page (replaces the nav dropdown
 * as the place to change themes). */
export function ThemeChooser() {
  const { themeId, setThemeId } = useTheme();

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {THEMES.map((t) => {
          const active = themeId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setThemeId(t.id)}
              aria-pressed={active}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                active
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:bg-accent"
              }`}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-md ring-1 ring-border"
                style={{ background: t.swatch.bg }}
                aria-hidden
              >
                <span
                  className="size-4 rounded-full"
                  style={{ background: t.swatch.primary }}
                />
              </span>
              <span className="flex-1 text-sm font-medium">{t.label}</span>
              {active && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Your theme is saved to this browser.
      </p>
    </div>
  );
}
