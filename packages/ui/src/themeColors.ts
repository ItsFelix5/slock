import { createSignal } from "solid-js";
import { dependentThemeColorKeys, withDerivedThemeColors } from "./themeDerivations";
import { LIGHT_THEME_COLORS, THEME_PRESETS as PRESETS } from "./themePresets";

export interface ThemeColors {
  accent?: string;
  accentBorder?: string;
  accentBorderStrong?: string;
  accentEmphasis?: string;
  accentHover?: string;
  accentMuted?: string;
  accentSubtle?: string;
  activeBg?: string;
  badgeBg?: string;
  blockKitButtonDanger?: string;
  blockKitButtonPrimary?: string;
  border?: string;
  borderStrong?: string;
  codeBg?: string;
  composerBg?: string;
  controlContrastBorder?: string;
  danger?: string;
  dangerMuted?: string;
  dangerSubtle?: string;
  embeddedContentBg?: string;
  errorBg?: string;
  errorText?: string;
  focusRingColor?: string;
  font?: string;
  highlightBg?: string;
  hoverBg?: string;
  linkColor?: string;
  mainBg?: string;
  mediaLensBorder?: string;
  mentionBg?: string;
  mentionHoverBg?: string;
  mentionInaccessibleBg?: string;
  mentionInaccessibleHoverBg?: string;
  mentionInaccessibleText?: string;
  mentionSelfBg?: string;
  mentionSelfHoverBg?: string;
  mentionSelfText?: string;
  mentionText?: string;
  moderationBanned?: string;
  moderationRestricted?: string;
  moderationUnverified?: string;
  overlayBackdrop?: string;
  presenceActive?: string;
  presenceAway?: string;
  railBg?: string;
  scrimStrong?: string;
  shadowColor?: string;
  shadowColorSoft?: string;
  sidebarBg?: string;
  success?: string;
  textDim?: string;
  textOnAccent?: string;
  textOnAvatar?: string;
  textOnDanger?: string;
  textOnSuccess?: string;
  textDisabled?: string;
  textPrimary?: string;
  textSecondary?: string;
  warning?: string;
  warningEmphasis?: string;
  warningMuted?: string;
  warningSubtle?: string;
}

export interface ThemePreset {
  colorScheme?: "dark" | "light";
  colors: ThemeColors;
  id: string;
  label: string;
}

const THEME_COLOR_DEFINITIONS = {
  accent: ["--accent", "Accent"],
  accentBorder: ["--accent-border", "Accent border"],
  accentBorderStrong: ["--accent-border-strong", "Accent border (strong)"],
  accentEmphasis: ["--accent-emphasis", "Accent emphasis"],
  accentHover: ["--accent-hover", "Accent (hover)"],
  accentMuted: ["--accent-muted", "Accent muted"],
  accentSubtle: ["--accent-subtle", "Accent subtle"],
  activeBg: ["--active-bg", "Active background"],
  badgeBg: ["--badge-bg", "Badge background"],
  blockKitButtonDanger: ["--bk-button-danger", "Block Kit button (danger)"],
  blockKitButtonPrimary: ["--bk-button-primary", "Block Kit button (primary)"],
  border: ["--border", "Border"],
  borderStrong: ["--border-strong", "Border (strong)"],
  codeBg: ["--code-bg", "Code background"],
  composerBg: ["--composer-bg", "Composer background"],
  controlContrastBorder: ["--control-contrast-border", "Control contrast border"],
  danger: ["--danger", "Danger"],
  dangerMuted: ["--danger-muted", "Danger muted"],
  dangerSubtle: ["--danger-subtle", "Danger subtle"],
  embeddedContentBg: ["--embedded-content-bg", "Embedded content background"],
  errorBg: ["--error-bg", "Error background"],
  errorText: ["--error-text", "Error text"],
  focusRingColor: ["--focus-ring-color", "Focus ring"],
  highlightBg: ["--highlight-bg", "Highlight background"],
  hoverBg: ["--hover-bg", "Hover background"],
  linkColor: ["--link-color", "Link"],
  mainBg: ["--main-bg", "Main background"],
  mediaLensBorder: ["--media-lens-border", "Media lens border"],
  mentionBg: ["--mention-bg", "Mention background"],
  mentionHoverBg: ["--mention-hover-bg", "Mention background (hover)"],
  mentionInaccessibleBg: ["--mention-inaccessible-bg", "Mention inaccessible background"],
  mentionInaccessibleHoverBg: [
    "--mention-inaccessible-hover-bg",
    "Mention inaccessible background (hover)",
  ],
  mentionInaccessibleText: ["--mention-inaccessible-text", "Mention inaccessible text"],
  mentionSelfBg: ["--mention-self-bg", "Mention self background"],
  mentionSelfHoverBg: ["--mention-self-hover-bg", "Mention self background (hover)"],
  mentionSelfText: ["--mention-self-text", "Mention (self)"],
  mentionText: ["--mention-text", "Mention text"],
  moderationBanned: ["--moderation-banned", "Moderation (banned)"],
  moderationRestricted: ["--moderation-restricted", "Moderation (restricted)"],
  moderationUnverified: ["--moderation-unverified", "Moderation (unverified)"],
  overlayBackdrop: ["--overlay-backdrop", "Overlay backdrop"],
  presenceActive: ["--presence-active", "Presence (active)"],
  presenceAway: ["--presence-away", "Presence (away)"],
  railBg: ["--rail-bg", "Rail background"],
  scrimStrong: ["--scrim-strong", "Strong scrim"],
  shadowColor: ["--shadow-color", "Shadow"],
  shadowColorSoft: ["--shadow-color-soft", "Soft shadow"],
  sidebarBg: ["--sidebar-bg", "Sidebar background"],
  success: ["--success", "Success"],
  textDim: ["--text-dim", "Text (dim)"],
  textOnAccent: ["--text-on-accent", "Text on accent"],
  textOnAvatar: ["--text-on-avatar", "Text on avatar"],
  textOnDanger: ["--text-on-danger", "Text on danger"],
  textOnSuccess: ["--text-on-success", "Text on success"],
  textDisabled: ["--text-disabled", "Text (disabled)"],
  textPrimary: ["--text-primary", "Text (primary)"],
  textSecondary: ["--text-secondary", "Text (secondary)"],
  warning: ["--warning", "Warning"],
  warningEmphasis: ["--warning-emphasis", "Warning emphasis"],
  warningMuted: ["--warning-muted", "Warning muted"],
  warningSubtle: ["--warning-subtle", "Warning subtle"],
} satisfies Record<Exclude<keyof ThemeColors, "font">, [string, string]>;

const THEME_COLOR_VARS = {
  font: "--font",
  ...Object.fromEntries(
    Object.entries(THEME_COLOR_DEFINITIONS).map(([key, [cssVar]]) => [key, cssVar]),
  ),
} as Record<keyof ThemeColors, string>;

const THEME_COLOR_LABELS: Record<Exclude<keyof ThemeColors, "font">, string> = Object.fromEntries(
  Object.entries(THEME_COLOR_DEFINITIONS).map(([key, [, label]]) => [key, label]),
) as Record<Exclude<keyof ThemeColors, "font">, string>;

const THEME_COLORS_KEY = "slock-theme-colors";
const THEME_PRESET_KEY = "slock-theme-preset";
const THEME_COLOR_SCHEME_KEY = "slock-theme-color-scheme";
const PRESET_MIGRATIONS: Record<string, string> = { pastel: "nord" };
const PREVIOUS_CHARCOAL = {
  accent: "oklch(0.66 0.145 250)",
  mainBg: "oklch(0.175 0.01 255)",
  sidebarBg: "oklch(0.105 0.008 255)",
};

function migratedPreset(colors: ThemeColors): ThemePreset | undefined {
  const wasCharcoal = (Object.keys(PREVIOUS_CHARCOAL) as (keyof typeof PREVIOUS_CHARCOAL)[]).every(
    (key) => colors[key] === PREVIOUS_CHARCOAL[key],
  );
  return wasCharcoal ? PRESETS.find((preset) => preset.id === "dark") : undefined;
}

function loadThemeColors(): ThemeColors {
  try {
    const storedPresetId = localStorage.getItem(THEME_PRESET_KEY);
    const presetId = storedPresetId
      ? (PRESET_MIGRATIONS[storedPresetId] ?? storedPresetId)
      : undefined;
    const preset = PRESETS.find((candidate) => candidate.id === presetId);
    const raw = localStorage.getItem(THEME_COLORS_KEY);
    const overrides = raw ? JSON.parse(raw) : {};
    if (preset) {
      if (presetId !== storedPresetId) localStorage.setItem(THEME_PRESET_KEY, preset.id);
      return { ...preset.colors, ...overrides };
    }
    const migrated = migratedPreset(overrides);
    if (migrated) {
      localStorage.removeItem(THEME_COLORS_KEY);
      localStorage.setItem(THEME_PRESET_KEY, migrated.id);
      return migrated.colors;
    }
    const legacyTheme = localStorage.getItem("slock-theme");
    const usedLightTheme =
      legacyTheme === "light" ||
      (legacyTheme === "system" && window.matchMedia?.("(prefers-color-scheme: light)").matches);
    return usedLightTheme ? { ...LIGHT_THEME_COLORS, ...overrides } : overrides;
  } catch {
    return {};
  }
}

function loadThemeColorScheme(): "dark" | "light" {
  const stored = localStorage.getItem(THEME_COLOR_SCHEME_KEY);
  if (stored === "dark" || stored === "light") return stored;

  const storedPresetId = localStorage.getItem(THEME_PRESET_KEY);
  const presetId = storedPresetId
    ? (PRESET_MIGRATIONS[storedPresetId] ?? storedPresetId)
    : undefined;
  const preset = PRESETS.find((candidate) => candidate.id === presetId);
  if (preset?.colorScheme) return preset.colorScheme;

  const legacyTheme = localStorage.getItem("slock-theme");
  if (legacyTheme === "light") return "light";
  if (legacyTheme === "system" && window.matchMedia?.("(prefers-color-scheme: light)").matches)
    return "light";
  return "dark";
}

function applyThemeColorScheme(scheme: "dark" | "light", persist: boolean) {
  document.documentElement.dataset.colorScheme = scheme;
  if (persist) localStorage.setItem(THEME_COLOR_SCHEME_KEY, scheme);
}

function applyThemeColors(colors: ThemeColors) {
  for (const key of Object.keys(colors) as (keyof ThemeColors)[]) {
    const value = colors[key];
    if (value !== undefined)
      document.documentElement.style.setProperty(THEME_COLOR_VARS[key], value);
  }
}

const [themeColors, setThemeColorsSignal] = createSignal<ThemeColors>(loadThemeColors());
applyThemeColors(themeColors());
applyThemeColorScheme(loadThemeColorScheme(), false);

export function setThemeColors(overrides: ThemeColors): void {
  const expanded = withDerivedThemeColors(overrides);
  const merged = { ...themeColors(), ...expanded };
  setThemeColorsSignal(merged);
  applyThemeColors(expanded);
  localStorage.setItem(THEME_COLORS_KEY, JSON.stringify(merged));
}

export function resetThemeColors(): void {
  for (const cssVar of Object.values(THEME_COLOR_VARS)) {
    document.documentElement.style.removeProperty(cssVar);
  }
  setThemeColorsSignal({});
  localStorage.removeItem(THEME_COLORS_KEY);
  localStorage.removeItem(THEME_PRESET_KEY);
  localStorage.removeItem(THEME_COLOR_SCHEME_KEY);
  applyThemeColorScheme("dark", false);
}

export function resetThemeColor(key: keyof ThemeColors): void {
  const next = { ...themeColors() };
  const storedPresetId = localStorage.getItem(THEME_PRESET_KEY);
  const presetId = storedPresetId
    ? (PRESET_MIGRATIONS[storedPresetId] ?? storedPresetId)
    : undefined;
  const presetValue = PRESETS.find((preset) => preset.id === presetId)?.colors[key];
  const resetKeys = [key, ...dependentThemeColorKeys(key)];
  if (presetValue === undefined) {
    for (const resetKey of resetKeys) {
      delete next[resetKey];
      document.documentElement.style.removeProperty(THEME_COLOR_VARS[resetKey]);
    }
  } else {
    const preset = PRESETS.find((candidate) => candidate.id === presetId);
    for (const resetKey of resetKeys) {
      const value = preset?.colors[resetKey];
      if (value === undefined) continue;
      next[resetKey] = value;
      document.documentElement.style.setProperty(THEME_COLOR_VARS[resetKey], value);
    }
  }
  setThemeColorsSignal(next);
  localStorage.setItem(THEME_COLORS_KEY, JSON.stringify(next));
}

export function getEffectiveColor(key: keyof ThemeColors): string {
  const override = themeColors()[key];
  if (override) return override;
  return getComputedStyle(document.documentElement).getPropertyValue(THEME_COLOR_VARS[key]).trim();
}

export function copyableThemePalette(): string {
  const styles = getComputedStyle(document.documentElement);
  return THEME_COLOR_KEYS.map((key) => styles.getPropertyValue(THEME_COLOR_VARS[key]).trim()).join(
    "|",
  );
}

export function applyCopiedThemePalette(payload: string): boolean {
  const values = payload.trim().split("|");
  if (
    values.length !== THEME_COLOR_KEYS.length ||
    values.some((value) => !CSS.supports("color", value))
  )
    return false;

  setThemeColors(Object.fromEntries(THEME_COLOR_KEYS.map((key, index) => [key, values[index]])));
  return true;
}

export function applyPreset(preset: ThemePreset): void {
  resetThemeColors();
  setThemeColorsSignal(preset.colors);
  applyThemeColors(preset.colors);
  localStorage.setItem(THEME_PRESET_KEY, preset.id);
  applyThemeColorScheme(preset.colorScheme ?? "dark", true);
}

export function activePreset(): string {
  const colors = themeColors();
  if (!THEME_COLOR_KEYS.some((key) => colors[key] !== undefined)) return "dark";
  for (const preset of PRESETS) {
    const matches = (Object.keys(preset.colors) as (keyof ThemeColors)[]).every(
      (key) => colors[key]?.trim().toLowerCase() === preset.colors[key]?.trim().toLowerCase(),
    );
    if (matches) return preset.id;
  }
  return "custom";
}

export const THEME_COLOR_KEYS = Object.keys(THEME_COLOR_VARS).filter(
  (key) => key !== "font",
) as Exclude<keyof ThemeColors, "font">[];

export const THEME_PRESETS = PRESETS;
export { THEME_COLOR_LABELS, themeColors };
