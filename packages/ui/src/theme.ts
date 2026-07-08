import { createSignal } from "solid-js";

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
};

const THEME_COLORS_KEY = "slock-theme-colors";

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
    if (value !== undefined)
      document.documentElement.style.setProperty(THEME_COLOR_VARS[key], value);
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
  setThemeColorsSignal({});
  localStorage.removeItem(THEME_COLORS_KEY);
}

export { compactMode, theme, themeColors };
