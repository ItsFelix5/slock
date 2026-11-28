import { defined } from "@slock/core";
import { cssColorToOklch, type OklchColor } from "@slock/ui";
import { AYU } from "./officialThemes/ayu";
import { CATPPUCCIN } from "./officialThemes/catppuccin";
import { EVERFOREST } from "./officialThemes/everforest";
import { GITHUB } from "./officialThemes/github";
import { GRUVBOX } from "./officialThemes/gruvbox";
import { KANAGAWA } from "./officialThemes/kanagawa";
import { ONE } from "./officialThemes/one";
import { ROSE_PINE } from "./officialThemes/rosePine";
import { STANDALONE_FAMILIES } from "./officialThemes/standalone";
import { TOKYO_NIGHT } from "./officialThemes/tokyoNight";
import { FILLET } from "./styledThemes/fillet";
import { FILLET_INDIGO } from "./styledThemes/filletIndigo";
import { FLOAT } from "./styledThemes/float";
import { GRAPHITE } from "./styledThemes/graphite";
import { ISLANDS } from "./styledThemes/islands";
import { ONYX } from "./styledThemes/onyx";
import { DARK_THEME_BASE } from "./themeBases";
import { BUILTIN_THEME_COLORS } from "./themeColorBuiltins";
import type { ThemeColors } from "./themeColorRegistry";
import { parseColorRef } from "./themeDerivations";
import { PALETTE_PRESETS } from "./themePalettes";

export interface ThemePreset {
  colorScheme?: "dark" | "light";
  colors: ThemeColors;
  css?: string;
  font?: string;
  id: string;
  label: string;
}

export interface ThemeFamily {
  id: string;
  label: string;
  presets: ThemePreset[];
  source?: string;
}

const CHARCOAL_THEME_BASE = {
  accent: "oklch(0.55 0.19 260)",
  accentHover: "@accent 6%L -2%C",
  badgeBg: "@danger -8%L 4%C",
  border: "@textSecondary 10%",
  borderStrong: "@textSecondary 18%",
  codeBg: "@mainBg 4%L 48%",
  composerBg: "@mainBg 3%L",
  danger: "oklch(0.68 0.19 25)",
  mainBg: "oklch(0.08 0 0)",
  mentionInaccessibleText: "@textDim 9%L",
  mentionText: "@accent 6%L -2%C",
  presenceActive: "oklch(0.7 0.16 155)",
  railBg: "@mainBg",
  sidebarBg: "@mainBg",
  textDim: "@textPrimary -37%L",
  textOnAccent: "oklch(0.98 0 0)",
  textOnAvatar: "@textPrimary 8%L",
  textPrimary: "oklch(0.96 0 0)",
  textSecondary: "@textPrimary -35%L",
  warning: "oklch(0.8 0.14 82)",
} satisfies ThemeColors;

const single = (preset: ThemePreset): ThemeFamily => ({
  id: preset.id,
  label: preset.label,
  presets: [preset],
});

const SLATE_FAMILY: ThemeFamily = {
  id: "slate",
  label: "Slate",
  presets: [
    { colors: DARK_THEME_BASE, id: "dark", label: "Slate" },
    { colors: CHARCOAL_THEME_BASE, id: "charcoal", label: "Charcoal" },
    ONYX,
  ],
};

const FILLET_FAMILY: ThemeFamily = {
  id: "fillet",
  label: "Fillet",
  presets: [FILLET, FILLET_INDIGO],
};

const ownPresets: ThemePreset[] = [GRAPHITE, ISLANDS, FLOAT, ...PALETTE_PRESETS];

const MAX_REFERENCE_DEPTH = 12;

export function resolvePresetColor(preset: ThemePreset, key: string, depth = 0): OklchColor {
  if (depth > MAX_REFERENCE_DEPTH) throw new Error(`${preset.id}: reference cycle at ${key}`);
  const raw = preset.colors[key] ?? BUILTIN_THEME_COLORS.find((def) => def.key === key)?.derive;
  if (raw === undefined) throw new Error(`${preset.id}: ${key} has no value`);
  const ref = parseColorRef(raw);
  if (!ref) return cssColorToOklch(raw);
  const source = resolvePresetColor(preset, ref.source, depth + 1);
  return {
    alpha: ref.alpha === undefined ? source.alpha : ref.alpha / 100,
    chroma: Math.max(0, source.chroma + (ref.deltaC ?? 0) / 100),
    hue: source.hue,
    lightness: Math.min(1, Math.max(0, source.lightness + (ref.deltaL ?? 0) / 100)),
  };
}

const ALL_FAMILIES: ThemeFamily[] = [
  SLATE_FAMILY,
  FILLET_FAMILY,
  ...ownPresets.map(single),
  CATPPUCCIN,
  GRUVBOX,
  ROSE_PINE,
  TOKYO_NIGHT,
  ONE,
  GITHUB,
  EVERFOREST,
  KANAGAWA,
  AYU,
  ...STANDALONE_FAMILIES,
];

const FAMILY_ORDER = [
  "slate",
  "github",
  "islands",
  "coffee",
  "graphite",
  "gruvbox",
  "dusk",
  "ocean",
  "dracula",
  "tokyo-night",
  "catppuccin",
  "kanagawa",
  "rose-pine",
  "synthwave",
  "monokai",
  "fillet",
  "everforest",
  "nord",
  "one",
  "ayu",
  "snowdrift",
  "float",
];

export const THEME_FAMILIES: ThemeFamily[] = FAMILY_ORDER.map((id) =>
  defined(ALL_FAMILIES.find((family) => family.id === id)),
);

export const THEME_PRESETS: ThemePreset[] = THEME_FAMILIES.flatMap((family) => family.presets);
