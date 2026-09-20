import { createSignal } from "solid-js";
import { cssColorToOklch, formatOklch, resolvedCssColor } from "./form/oklchColor";
import type { ThemeColors, ThemePreset } from "./themeColorDefinitions";
import { isThemeColorKey, THEME_COLOR_KEYS, THEME_COLOR_VARS } from "./themeColorDefinitions";
import {
  DERIVED_COLOR_REFS,
  isColorRef,
  isDerivedColorKey,
  resolveThemeColorValue,
} from "./themeDerivations";
import { THEME_PRESETS as PRESETS } from "./themePresets";

export type { ThemeColors, ThemePreset } from "./themeColorDefinitions";
export {
  THEME_ADVANCED_COLOR_KEYS,
  THEME_BASE_COLOR_KEYS,
  THEME_COLOR_KEYS,
  THEME_COLOR_LABELS,
} from "./themeColorDefinitions";
export { colorScheme, themeColors };

const THEME_COLORS_KEY = "slock-theme-colors";
const THEME_PRESET_KEY = "slock-theme-preset";
const THEME_COLOR_SCHEME_KEY = "slock-theme-color-scheme";

function loadThemeColors(): ThemeColors {
  try {
    const presetId = localStorage.getItem(THEME_PRESET_KEY) ?? undefined;
    const preset =
      PRESETS.find((candidate) => candidate.id === presetId) ??
      PRESETS.find((candidate) => candidate.id === "dark");
    const raw = localStorage.getItem(THEME_COLORS_KEY);
    const overrides = raw ? JSON.parse(raw) : {};
    return { ...preset?.colors, ...overrides };
  } catch {
    return {};
  }
}

function loadThemeColorScheme(): "dark" | "light" {
  const stored = localStorage.getItem(THEME_COLOR_SCHEME_KEY);
  if (stored === "dark" || stored === "light") return stored;

  const presetId = localStorage.getItem(THEME_PRESET_KEY) ?? undefined;
  const preset = PRESETS.find((candidate) => candidate.id === presetId);
  return preset?.colorScheme ?? "dark";
}

const [colorScheme, setColorSchemeSignal] = createSignal<"dark" | "light">("dark");

function applyThemeColorScheme(scheme: "dark" | "light", persist: boolean) {
  document.documentElement.dataset.colorScheme = scheme;
  setColorSchemeSignal(scheme);
  if (persist) localStorage.setItem(THEME_COLOR_SCHEME_KEY, scheme);
}

function applyThemeColors(colors: ThemeColors) {
  for (const key of Object.keys(colors)) {
    if (!isThemeColorKey(key)) continue;
    const value = colors[key];
    if (value !== undefined)
      document.documentElement.style.setProperty(
        THEME_COLOR_VARS[key],
        resolveThemeColorValue(value),
      );
  }
}

const [themeColors, setThemeColorsSignal] = createSignal<ThemeColors>(loadThemeColors());
applyThemeColors(themeColors());
applyThemeColorScheme(loadThemeColorScheme(), false);

export function setThemeColors(overrides: ThemeColors): void {
  const merged = { ...themeColors(), ...overrides };
  setThemeColorsSignal(merged);
  applyThemeColors(overrides);
  localStorage.setItem(THEME_COLORS_KEY, JSON.stringify(merged));
}

export function replaceThemeColors(colors: ThemeColors, scheme: "dark" | "light"): void {
  for (const cssVar of Object.values(THEME_COLOR_VARS)) {
    document.documentElement.style.removeProperty(cssVar);
  }
  localStorage.removeItem(THEME_PRESET_KEY);
  setThemeColorsSignal(colors);
  applyThemeColors(colors);
  localStorage.setItem(THEME_COLORS_KEY, JSON.stringify(colors));
  applyThemeColorScheme(scheme, true);
}

function clearThemeColorVars(): void {
  for (const cssVar of Object.values(THEME_COLOR_VARS)) {
    document.documentElement.style.removeProperty(cssVar);
  }
}

export function resetThemeColors(): void {
  clearThemeColorVars();
  setThemeColorsSignal({});
  localStorage.removeItem(THEME_COLORS_KEY);
  localStorage.removeItem(THEME_PRESET_KEY);
  localStorage.removeItem(THEME_COLOR_SCHEME_KEY);
  applyThemeColorScheme("dark", false);
}

export function resetThemeColor(key: keyof ThemeColors): void {
  const next = { ...themeColors() };
  delete next[key];
  const presetId = localStorage.getItem(THEME_PRESET_KEY) ?? undefined;
  const presetValue = PRESETS.find((preset) => preset.id === presetId)?.colors[key];
  const fallback = presetValue ?? (isDerivedColorKey(key) ? DERIVED_COLOR_REFS[key] : undefined);
  if (fallback === undefined) document.documentElement.style.removeProperty(THEME_COLOR_VARS[key]);
  else
    document.documentElement.style.setProperty(
      THEME_COLOR_VARS[key],
      resolveThemeColorValue(fallback),
    );
  setThemeColorsSignal(next);
  localStorage.setItem(THEME_COLORS_KEY, JSON.stringify(next));
}

function effectiveRawValue(key: keyof ThemeColors): string {
  const override = themeColors()[key];
  if (override !== undefined) return override;
  const computed = getComputedStyle(document.documentElement)
    .getPropertyValue(THEME_COLOR_VARS[key])
    .trim();
  if (isDerivedColorKey(key)) {
    const formula = DERIVED_COLOR_REFS[key];
    if (resolvedCssColor(computed) === resolvedCssColor(resolveThemeColorValue(formula)))
      return formula;
  }
  return computed;
}

export function getEffectiveColor(key: keyof ThemeColors): string {
  return resolveThemeColorValue(effectiveRawValue(key));
}

export function getColorFormula(key: keyof ThemeColors): string {
  const raw = effectiveRawValue(key);
  return isColorRef(raw) ? raw : formatOklch(cssColorToOklch(resolveThemeColorValue(raw)));
}

export function copyableThemePalette(): string {
  return THEME_COLOR_KEYS.map((key) => formatOklch(cssColorToOklch(getEffectiveColor(key)))).join(
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
  clearThemeColorVars();
  setThemeColorsSignal(preset.colors);
  applyThemeColors(preset.colors);
  localStorage.setItem(THEME_PRESET_KEY, preset.id);
  localStorage.removeItem(THEME_COLORS_KEY);
  applyThemeColorScheme(preset.colorScheme ?? "dark", true);
}

export function activePreset(): string {
  const colors = themeColors();
  if (!THEME_COLOR_KEYS.some((key) => colors[key] !== undefined)) return "dark";
  for (const preset of PRESETS) {
    const matches = Object.keys(preset.colors).every((key) => {
      if (!isThemeColorKey(key)) return true;
      return colors[key]?.trim().toLowerCase() === preset.colors[key]?.trim().toLowerCase();
    });
    if (matches) return preset.id;
  }
  return "custom";
}

export const THEME_PRESETS = PRESETS;
