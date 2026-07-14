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
const LOG_DELETED_KEY = "slock-log-deleted-messages";
const [logDeletedMessages, setLogDeletedMessagesSignal] = createSignal(
  localStorage.getItem(LOG_DELETED_KEY) === "1",
);
export function setLogDeletedMessages(on: boolean) {
  setLogDeletedMessagesSignal(on);
  localStorage.setItem(LOG_DELETED_KEY, on ? "1" : "0");
}
export interface ThemeColors {
  accent?: string;
  accentHover?: string;
  activeBg?: string;
  badgeBg?: string;
  border?: string;
  borderStrong?: string;
  composerBg?: string;
  danger?: string;
  font?: string;
  hoverBg?: string;
  mainBg?: string;
  mentionSelfText?: string;
  mentionText?: string;
  presenceActive?: string;
  railBg?: string;
  sidebarBg?: string;
  textDim?: string;
  textOnAccent?: string;
  textPrimary?: string;
  textSecondary?: string;
  warning?: string;
}
const THEME_COLOR_VARS: Record<keyof ThemeColors, string> = {
  accent: "--accent",
  accentHover: "--accent-hover",
  activeBg: "--active-bg",
  badgeBg: "--badge-bg",
  border: "--border",
  borderStrong: "--border-strong",
  composerBg: "--composer-bg",
  danger: "--danger",
  font: "--font",
  hoverBg: "--hover-bg",
  mainBg: "--main-bg",
  mentionSelfText: "--mention-self-text",
  mentionText: "--mention-text",
  presenceActive: "--presence-active",
  railBg: "--rail-bg",
  sidebarBg: "--sidebar-bg",
  textDim: "--text-dim",
  textOnAccent: "--text-on-accent",
  textPrimary: "--text-primary",
  textSecondary: "--text-secondary",
  warning: "--warning",
};
const THEME_COLORS_KEY = "slock-theme-colors";
const HEX_COLOR_RE = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
function hexToRgbTriplet(hex: string): string {
  const result = HEX_COLOR_RE.exec(hex);
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
  if (key === "accent") document.documentElement.style.removeProperty("--accent-rgb");
  else if (key === "danger") document.documentElement.style.removeProperty("--danger-rgb");
  localStorage.setItem(THEME_COLORS_KEY, JSON.stringify(next));
}
export const THEME_COLOR_KEYS = Object.keys(THEME_COLOR_VARS).filter(
  (k) => k !== "font",
) as Exclude<keyof ThemeColors, "font">[];
export const THEME_COLOR_LABELS: Record<Exclude<keyof ThemeColors, "font">, string> = {
  accent: "Accent",
  accentHover: "Accent (hover)",
  activeBg: "Active background",
  badgeBg: "Badge background",
  border: "Border",
  borderStrong: "Border (strong)",
  composerBg: "Composer background",
  danger: "Danger",
  hoverBg: "Hover background",
  mainBg: "Main background",
  mentionSelfText: "Mention (self)",
  mentionText: "Mention text",
  presenceActive: "Presence (active)",
  railBg: "Rail background",
  sidebarBg: "Sidebar background",
  textDim: "Text (dim)",
  textOnAccent: "Text on accent",
  textPrimary: "Text (primary)",
  textSecondary: "Text (secondary)",
  warning: "Warning",
};
export { THEME_COLOR_VARS };
export function getEffectiveColor(key: keyof ThemeColors): string {
  const override = themeColors()[key];
  if (override) return override;
  return getComputedStyle(document.documentElement).getPropertyValue(THEME_COLOR_VARS[key]).trim();
}
export interface ThemePreset {
  colors: Pick<ThemeColors, "accent" | "accentHover" | "presenceActive" | "badgeBg">;
  id: string;
  label: string;
}
export const THEME_PRESETS: ThemePreset[] = [
  {
    colors: {
      accent: "#1264a3",
      accentHover: "#0b5385",
      badgeBg: "#cd2553",
      presenceActive: "#2eb67d",
    },
    id: "default",
    label: "Default",
  },
  {
    colors: {
      accent: "#611f69",
      accentHover: "#4a154b",
      badgeBg: "#e01e5a",
      presenceActive: "#2bac76",
    },
    id: "aubergine",
    label: "Aubergine",
  },
  {
    colors: {
      accent: "#2f855a",
      accentHover: "#276749",
      badgeBg: "#dd6b20",
      presenceActive: "#48bb78",
    },
    id: "forest",
    label: "Forest",
  },
  {
    colors: {
      accent: "#b91c1c",
      accentHover: "#991b1b",
      badgeBg: "#db2777",
      presenceActive: "#16a34a",
    },
    id: "crimson",
    label: "Crimson",
  },
  {
    colors: {
      accent: "#ea580c",
      accentHover: "#c2410c",
      badgeBg: "#db2777",
      presenceActive: "#22c55e",
    },
    id: "sunset",
    label: "Sunset",
  },
  {
    colors: {
      accent: "#52525b",
      accentHover: "#3f3f46",
      badgeBg: "#ef4444",
      presenceActive: "#71717a",
    },
    id: "slate",
    label: "Slate",
  },
];
export function applyPreset(preset: ThemePreset): void {
  setThemeColors(preset.colors);
}
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
