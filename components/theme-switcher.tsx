"use client";

import { useTheme } from "next-themes";
import { Palette } from "lucide-react";
import { THEMES } from "@/lib/themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          <Palette />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => setTheme(t.value)}
            className="justify-between"
          >
            <span className="flex items-center gap-2">
              <span
                className="size-3 rounded-full border border-border"
                style={{ background: t.swatch }}
              />
              {t.label}
            </span>
            {theme === t.value ? (
              <span className="text-[11px] text-muted">Active</span>
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme("system")}>
          Match system
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
