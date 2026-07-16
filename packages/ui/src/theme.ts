import { createMemo, createSignal } from "solid-js";
export type MessageSize = 0 | 1 | 2;
const MESSAGE_SIZE_KEY = "slock-message-size";
const LEGACY_COMPACT_KEY = "slock-compact";
function loadMessageSize(): MessageSize {
  const raw = localStorage.getItem(MESSAGE_SIZE_KEY);
  const saved = raw === null ? Number.NaN : Number(raw);
  if (saved === 0 || saved === 1 || saved === 2) return saved;
  return localStorage.getItem(LEGACY_COMPACT_KEY) === "1" ? 0 : 1;
}
const [messageSize, setMessageSizeSignal] = createSignal<MessageSize>(loadMessageSize());
function applyMessageSize(size: MessageSize) {
  document.documentElement.dataset.messageSize = String(size);
}
applyMessageSize(messageSize());
export function setMessageSize(size: MessageSize) {
  setMessageSizeSignal(size);
  localStorage.setItem(MESSAGE_SIZE_KEY, String(size));
  localStorage.removeItem(LEGACY_COMPACT_KEY);
  applyMessageSize(size);
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
  codeBg?: string;
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
  codeBg: "--code-bg",
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
    const overrides = raw ? JSON.parse(raw) : {};
    const legacyTheme = localStorage.getItem("slock-theme");
    const usedLightTheme =
      legacyTheme === "light" ||
      (legacyTheme === "system" && window.matchMedia?.("(prefers-color-scheme: light)").matches);
    return usedLightTheme ? { ...LIGHT_THEME_COLORS, ...overrides } : overrides;
  } catch {
    return {};
  }
}
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
  codeBg: "Code background",
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
export function getEffectiveColor(key: keyof ThemeColors): string {
  const override = themeColors()[key];
  if (override) return override;
  return getComputedStyle(document.documentElement).getPropertyValue(THEME_COLOR_VARS[key]).trim();
}
export interface ThemePreset {
  colors: ThemeColors;
  id: string;
  label: string;
}
const DARK_THEME_COLORS = {
  accent: "#1264a3",
  accentHover: "#0b5385",
  activeBg: "rgba(255, 255, 255, 0.1)",
  badgeBg: "#cd2553",
  border: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.14)",
  codeBg: "rgba(0, 0, 0, 0.25)",
  composerBg: "#222529",
  danger: "#e0554a",
  hoverBg: "rgba(255, 255, 255, 0.06)",
  mainBg: "#1a1d21",
  mentionSelfText: "#e0a72d",
  mentionText: "#4bb6e8",
  presenceActive: "#2eb67d",
  railBg: "#191a20",
  sidebarBg: "#101214",
  textDim: "rgba(224, 224, 224, 0.45)",
  textOnAccent: "#fff",
  textPrimary: "#d1d2d3",
  textSecondary: "rgba(224, 224, 224, 0.7)",
  warning: "#f39c12",
} satisfies ThemeColors;
const LIGHT_THEME_COLORS = {
  ...DARK_THEME_COLORS,
  activeBg: "rgba(18, 100, 163, 0.12)",
  border: "rgba(0, 0, 0, 0.09)",
  borderStrong: "rgba(0, 0, 0, 0.16)",
  codeBg: "rgba(0, 0, 0, 0.08)",
  composerBg: "#ffffff",
  danger: "#cc3333",
  hoverBg: "rgba(0, 0, 0, 0.05)",
  mainBg: "#ffffff",
  railBg: "#f7f7f8",
  sidebarBg: "#f0f0f2",
  textDim: "rgba(29, 28, 29, 0.45)",
  textPrimary: "#1d1c1d",
  textSecondary: "rgba(29, 28, 29, 0.7)",
} satisfies ThemeColors;
const [themeColors, setThemeColorsSignal] = createSignal<ThemeColors>(loadThemeColors());
applyThemeColors(themeColors());
export const THEME_PRESETS: ThemePreset[] = [
  {
    colors: DARK_THEME_COLORS,
    id: "dark",
    label: "Dark",
  },
  {
    colors: LIGHT_THEME_COLORS,
    id: "light",
    label: "Light",
  },
  {
    colors: {
      ...DARK_THEME_COLORS,
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
      ...DARK_THEME_COLORS,
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
      ...DARK_THEME_COLORS,
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
      ...DARK_THEME_COLORS,
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
      ...DARK_THEME_COLORS,
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
  resetThemeColors();
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
export { logDeletedMessages, messageSize, themeColors };
