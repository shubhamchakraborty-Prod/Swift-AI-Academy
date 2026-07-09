"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";
import { THEME_VALUES } from "@/lib/themes";

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      themes={THEME_VALUES}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
