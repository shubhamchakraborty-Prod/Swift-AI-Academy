export type ThemeName =
  | "light"
  | "dark"
  | "midnight"
  | "teal"
  | "plum"
  | "pink"
  | "gold";

export const THEMES: { value: ThemeName; label: string; swatch: string }[] = [
  { value: "light", label: "Light", swatch: "#3D5AFE" },
  { value: "dark", label: "Dark", swatch: "#6F87FF" },
  { value: "midnight", label: "Midnight", swatch: "#0A1240" },
  { value: "teal", label: "Teal", swatch: "#0891B2" },
  { value: "plum", label: "Plum", swatch: "#6D28D9" },
  { value: "pink", label: "Pink", swatch: "#E91E63" },
  { value: "gold", label: "Gold", swatch: "#E08F0E" },
];

export const THEME_VALUES = THEMES.map((t) => t.value);
