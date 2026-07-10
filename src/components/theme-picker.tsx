"use client";

import { Check, Palette } from "lucide-react";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Theme selector. `triggerClassName` lets the nav chrome style the button
 * with its own rh-themebtn look; defaults to it. */
export function ThemePicker({ triggerClassName }: { triggerClassName?: string }) {
  const { themeId, setThemeId } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={triggerClassName ?? "rh-themebtn"}
          aria-label="Choose theme"
        >
          <Palette size={15} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onSelect={() => setThemeId(t.id)}
            className="gap-2"
          >
            <span
              className="flex size-4 shrink-0 items-center justify-center rounded-full ring-1 ring-border"
              style={{ background: t.swatch.bg }}
              aria-hidden
            >
              <span
                className="size-2 rounded-full"
                style={{ background: t.swatch.primary }}
              />
            </span>
            <span className="flex-1">{t.label}</span>
            {themeId === t.id && <Check className="size-4 shrink-0" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
