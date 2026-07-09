export type LogoVariant = "full" | "symbol";
export type LogoSurface = "light" | "dark";

interface LogoAsset {
  src: string;
  width: number;
  height: number;
  minWidth: number;
}

/**
 * Single source of truth for brand asset files. Swapping in the
 * client's final logo (once supplied as a real SVG/high-res PNG) is a
 * file-drop into public/brand/ plus an edit here — no component change.
 *
 * Current assets are a placeholder standing in for the client-supplied
 * node-network mark, which was only shared as a low-res pasted image
 * with no retrievable source file.
 */
export const LOGO_ASSETS: Record<LogoVariant, Record<LogoSurface, LogoAsset>> = {
  full: {
    light: { src: "/brand/logo-full.svg", width: 240, height: 64, minWidth: 120 },
    dark: { src: "/brand/logo-full-reversed.svg", width: 240, height: 64, minWidth: 120 },
  },
  symbol: {
    light: { src: "/brand/logo-symbol.svg", width: 64, height: 64, minWidth: 24 },
    dark: { src: "/brand/logo-symbol-reversed.svg", width: 64, height: 64, minWidth: 24 },
  },
};
