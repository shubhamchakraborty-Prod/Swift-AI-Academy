"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { LOGO_ASSETS, type LogoVariant, type LogoSurface } from "@/lib/brand";

const DARK_THEMES = new Set(["dark", "midnight"]);

interface LogoProps {
  variant?: LogoVariant;
  /** Force a surface instead of deriving it from the active theme. */
  surface?: LogoSurface;
  height?: number;
  className?: string;
}

export function Logo({ variant = "full", surface, height, className }: LogoProps) {
  const { resolvedTheme, theme } = useTheme();
  const activeSurface: LogoSurface =
    surface ?? (DARK_THEMES.has(theme ?? resolvedTheme ?? "light") ? "dark" : "light");

  const asset = LOGO_ASSETS[variant][activeSurface];
  const h = Math.max(height ?? asset.height, asset.minWidth * (asset.height / asset.width));
  const w = h * (asset.width / asset.height);

  return (
    <Image
      src={asset.src}
      alt="Swift AI Academy"
      width={Math.round(w)}
      height={Math.round(h)}
      priority
      className={cn("select-none", className)}
    />
  );
}
