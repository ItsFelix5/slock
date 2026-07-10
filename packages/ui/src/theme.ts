import { createMemo, createSignal } from "solid-js";

export type Theme = "dark" | "light" | "system";

const STORAGE_KEY = "slock-theme";

function initial(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "light" || saved === "system" ? saved : "dark";
}

const [theme, setThemeSignal] = createSignal<Theme>(initial());

const systemQuery = window.matchMedia?.("(prefers-color-scheme: light)");

function resolve(t: Theme): "dark" | "light" {
  return t === "system" ? (systemQuery?.matches ? "light" : "dark") : t;
}

function apply(t: Theme) {
  document.documentElement.classList.toggle("theme-light", resolve(t) === "light");
}
apply(theme());

// Live-follow the OS theme while "system" is selected, instead of only
// resolving it once at load.
systemQuery?.addEventListener("change", () => {
  if (theme() === "system") apply("system");
});

export function setTheme(t: Theme) {
  setThemeSignal(t);
  localStorage.setItem(STORAGE_KEY, t);
  apply(t);
}

const COMPACT_KEY = "slock-compact";
const [compactMode, setCompactModeSignal] = createSignal(localStorage.getItem(COMPACT_KEY) === "1");

function applyCompact(on: boolean) {
  document.documentElement.classList.toggle("compact-mode", on);
}
applyCompact(compactMode());

export function setCompactMode(on: boolean) {
  setCompactModeSignal(on);
  localStorage.setItem(COMPACT_KEY, on ? "1" : "0");
  applyCompact(on);
}

// Whether deleted messages stay visible (struck through) instead of being
// removed from the list entirely.
const LOG_DELETED_KEY = "slock-log-deleted-messages";
const [logDeletedMessages, setLogDeletedMessagesSignal] = createSignal(
  localStorage.getItem(LOG_DELETED_KEY) === "1",
);

export function setLogDeletedMessages(on: boolean) {
  setLogDeletedMessagesSignal(on);
  localStorage.setItem(LOG_DELETED_KEY, on ? "1" : "0");
}

// Runtime-overridable color tokens, on top of the static `:root`/`:root.theme-light`
// tokens in theme.css — lets any consumer of @slock/ui re-skin the app without
// forking the stylesheet. Applied as inline styles on <html>, which win over the
// stylesheet's :root rules regardless of cascade/theme.
export interface ThemeColors {
  railBg?: string;
  sidebarBg?: string;
  mainBg?: string;
  composerBg?: string;
  border?: string;
  borderStrong?: string;
  textPrimary?: string;
  textSecondary?: string;
  textDim?: string;
  accent?: string;
  accentHover?: string;
  presenceActive?: string;
  hoverBg?: string;
  activeBg?: string;
  badgeBg?: string;
  font?: string;
  danger?: string;
  warning?: string;
  textOnAccent?: string;
  mentionText?: string;
  mentionSelfText?: string;
}

const THEME_COLOR_VARS: Record<keyof ThemeColors, string> = {
  railBg: "--rail-bg",
  sidebarBg: "--sidebar-bg",
  mainBg: "--main-bg",
  composerBg: "--composer-bg",
  border: "--border",
  borderStrong: "--border-strong",
  textPrimary: "--text-primary",
  textSecondary: "--text-secondary",
  textDim: "--text-dim",
  accent: "--accent",
  accentHover: "--accent-hover",
  presenceActive: "--presence-active",
  hoverBg: "--hover-bg",
  activeBg: "--active-bg",
  badgeBg: "--badge-bg",
  font: "--font",
  danger: "--danger",
  warning: "--warning",
  textOnAccent: "--text-on-accent",
  mentionText: "--mention-text",
  mentionSelfText: "--mention-self-text",
};

const THEME_COLORS_KEY = "slock-theme-colors";

function hexToRgbTriplet(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "";
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `${r}, ${g}, ${b}`;
}

function loadThemeColors(): ThemeColors {
  try {
    const raw = localStorage.getItem(THEME_COLORS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const [themeColors, setThemeColorsSignal] = createSignal<ThemeColors>(loadThemeColors());

function applyThemeColors(colors: ThemeColors) {
  for (const key of Object.keys(colors) as (keyof ThemeColors)[]) {
    const value = colors[key];
    if (value !== undefined) {
      document.documentElement.style.setProperty(THEME_COLOR_VARS[key], value);
      // Keep RGB triplet companion vars in sync for colors that need opacity variants
      if (key === "accent" && value) {
        const rgb = hexToRgbTriplet(value);
        if (rgb) document.documentElement.style.setProperty("--accent-rgb", rgb);
      } else if (key === "danger" && value) {
        const rgb = hexToRgbTriplet(value);
        if (rgb) document.documentElement.style.setProperty("--danger-rgb", rgb);
      }
    }
  }
}
applyThemeColors(themeColors());

export function setThemeColors(overrides: ThemeColors): void {
  const merged = { ...themeColors(), ...overrides };
  setThemeColorsSignal(merged);
  applyThemeColors(overrides);
  localStorage.setItem(THEME_COLORS_KEY, JSON.stringify(merged));
}

export function resetThemeColors(): void {
  for (const cssVar of Object.values(THEME_COLOR_VARS)) {
    document.documentElement.style.removeProperty(cssVar);
  }
  // Also reset RGB companion vars
  document.documentElement.style.removeProperty("--accent-rgb");
  document.documentElement.style.removeProperty("--danger-rgb");
  setThemeColorsSignal({});
  localStorage.removeItem(THEME_COLORS_KEY);
}

export function resetThemeColor(key: keyof ThemeColors): void {
  const next = { ...themeColors() };
  delete next[key];
  setThemeColorsSignal(next);
  document.documentElement.style.removeProperty(THEME_COLOR_VARS[key]);
  // Also reset companion RGB var if resetting a color that has one
  if (key === "accent") document.documentElement.style.removeProperty("--accent-rgb");
  else if (key === "danger") document.documentElement.style.removeProperty("--danger-rgb");
  localStorage.setItem(THEME_COLORS_KEY, JSON.stringify(next));
}

// Every override-able color token (i.e. everything in ThemeColors except the
// non-color `font` entry), in the order they should be listed in a "literal
// color" editor UI.
export const THEME_COLOR_KEYS = Object.keys(THEME_COLOR_VARS).filter(
  (k) => k !== "font",
) as Exclude<keyof ThemeColors, "font">[];

export const THEME_COLOR_LABELS: Record<Exclude<keyof ThemeColors, "font">, string> = {
  railBg: "Rail background",
  sidebarBg: "Sidebar background",
  mainBg: "Main background",
  composerBg: "Composer background",
  border: "Border",
  borderStrong: "Border (strong)",
  textPrimary: "Text (primary)",
  textSecondary: "Text (secondary)",
  textDim: "Text (dim)",
  accent: "Accent",
  accentHover: "Accent (hover)",
  presenceActive: "Presence (active)",
  hoverBg: "Hover background",
  activeBg: "Active background",
  badgeBg: "Badge background",
  danger: "Danger",
  warning: "Warning",
  textOnAccent: "Text on accent",
  mentionText: "Mention text",
  mentionSelfText: "Mention (self)",
};

export { THEME_COLOR_VARS };

// The color actually in effect for a token right now: an explicit override if
// set, otherwise whatever the active stylesheet resolved for its CSS var.
export function getEffectiveColor(key: keyof ThemeColors): string {
  const override = themeColors()[key];
  if (override) return override;
  return getComputedStyle(document.documentElement).getPropertyValue(THEME_COLOR_VARS[key]).trim();
}

export interface ThemePreset {
  id: string;
  label: string;
  colors: Pick<ThemeColors, "accent" | "accentHover" | "presenceActive" | "badgeBg">;
}

// Presets only tint the accent family, leaving backgrounds/borders/text to the
// dark/light/system toggle above — so a preset looks right in either mode.
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    label: "Default",
    colors: {
      accent: "#1264a3",
      accentHover: "#0b5385",
      presenceActive: "#2eb67d",
      badgeBg: "#cd2553",
    },
  },
  {
    id: "aubergine",
    label: "Aubergine",
    colors: {
      accent: "#611f69",
      accentHover: "#4a154b",
      presenceActive: "#2bac76",
      badgeBg: "#e01e5a",
    },
  },
  {
    id: "forest",
    label: "Forest",
    colors: {
      accent: "#2f855a",
      accentHover: "#276749",
      presenceActive: "#48bb78",
      badgeBg: "#dd6b20",
    },
  },
  {
    id: "crimson",
    label: "Crimson",
    colors: {
      accent: "#b91c1c",
      accentHover: "#991b1b",
      presenceActive: "#16a34a",
      badgeBg: "#db2777",
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    colors: {
      accent: "#ea580c",
      accentHover: "#c2410c",
      presenceActive: "#22c55e",
      badgeBg: "#db2777",
    },
  },
  {
    id: "slate",
    label: "Slate",
    colors: {
      accent: "#52525b",
      accentHover: "#3f3f46",
      presenceActive: "#71717a",
      badgeBg: "#ef4444",
    },
  },
];

export function applyPreset(preset: ThemePreset): void {
  setThemeColors(preset.colors);
}

// Which preset (if any) matches the colors currently in effect — used to
// highlight the active swatch. "custom" means the user has hand-edited a
// value away from every known preset.
export const activePreset = createMemo((): string => {
  for (const preset of THEME_PRESETS) {
    const matches = (Object.keys(preset.colors) as (keyof ThemePreset["colors"])[]).every(
      (k) => getEffectiveColor(k).toLowerCase() === preset.colors[k]?.toLowerCase(),
    );
    if (matches) return preset.id;
  }
  return "custom";
});

export { compactMode, logDeletedMessages, theme, themeColors };
