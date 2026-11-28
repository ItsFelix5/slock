import type { ThemePreset } from "./themePresets";
import { officialPreset } from "./themeSwatches";

const fromRow = (scheme: "dark" | "light", row: string): ThemePreset => {
  const [
    id = "",
    label = "",
    bg = "",
    text = "",
    accent = "",
    danger = "",
    success = "",
    warning = "",
    link = "",
  ] = row.split("|");
  return officialPreset(id, label, scheme, {
    accent,
    bg,
    danger,
    link,
    onAccent: "@mainBg",
    success,
    text,
    warning,
  });
};

const DARK_ROWS = [
  "dusk|Dusk|#1c1e26|#cbced0|#e95378|#ec6a88|#29d398|#fab795|#25b0bc",
  "synthwave|Synthwave|#262335|#f4eeff|#ff7edb|#fe4450|#72f1b8|#fede5d|#36f9f6",
  "ocean|Ocean|#0f111a|#a6accd|#82aaff|#ff5370|#c3e88d|#ffcb6b|#89ddff",
  "coffee|Coffee|#1e1a17|#e8d9c5|#d08c60|#d9644a|#9fb46a|#e0b25a|#e0a77a",
];

const LIGHT_ROWS = ["snowdrift|Snowdrift|#eceff4|#2e3440|#44668f|#bf616a|#6f9a5b|#a8512f|#44668f"];

export const PALETTE_PRESETS: ThemePreset[] = [
  ...DARK_ROWS.map((row) => fromRow("dark", row)),
  ...LIGHT_ROWS.map((row) => fromRow("light", row)),
];
