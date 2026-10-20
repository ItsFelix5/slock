import { defined } from "@slock/core";
import { createSignal } from "solid-js";
import { cssColorToOklch, formatOklch } from "./form/oklchColor";
import { BUILTIN_THEME_COLORS } from "./themeColorBuiltins";
import {
  addThemeColorDefinitions,
  type ThemeColorDefinition,
  type ThemeColors,
  themeColorDefinitions,
  themeColorVar,
} from "./themeColorRegistry";
import {
  type ColorRef,
  formatColorRef,
  isColorRef,
  parseColorRef,
  resolveThemeColorValue,
} from "./themeDerivations";
import { THEME_PRESETS, type ThemePreset } from "./themePresets";

export { type ThemeColorDefinition, themeColorDefinitions } from "./themeColorRegistry";

const THEME_COLORS_KEY = "slock-theme-colors";
const THEME_PRESET_KEY = "slock-theme-preset";
const THEME_COLOR_SCHEME_KEY = "slock-theme-color-scheme";

const rootStyle = document.documentElement.style;

function storedPreset(): ThemePreset {
  const id = localStorage.getItem(THEME_PRESET_KEY);
  return THEME_PRESETS.find((preset) => preset.id === id) ?? defined(THEME_PRESETS[0]);
}

function loadThemeColors(): ThemeColors {
  try {
    const raw = localStorage.getItem(THEME_COLORS_KEY);
    return { ...storedPreset().colors, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return {};
  }
}

function applyThemeColorScheme(scheme: "dark" | "light", persist: boolean) {
  document.documentElement.dataset.colorScheme = scheme;
  if (persist) localStorage.setItem(THEME_COLOR_SCHEME_KEY, scheme);
}

function loadThemeColorScheme(): "dark" | "light" {
  const stored = localStorage.getItem(THEME_COLOR_SCHEME_KEY);
  return stored === "dark" || stored === "light" ? stored : (storedPreset().colorScheme ?? "dark");
}

const [themeColors, setThemeColorsSignal] = createSignal<ThemeColors>(loadThemeColors());

function applyThemeColor({ key, derive }: ThemeColorDefinition) {
  const value = themeColors()[key] ?? derive;
  if (value === undefined) rootStyle.removeProperty(themeColorVar(key));
  else rootStyle.setProperty(themeColorVar(key), resolveThemeColorValue(value));
}

function applyAllThemeColors() {
  for (const definition of themeColorDefinitions()) applyThemeColor(definition);
}

function storeThemeColors(colors: ThemeColors) {
  setThemeColorsSignal(colors);
  localStorage.setItem(THEME_COLORS_KEY, JSON.stringify(colors));
  applyAllThemeColors();
}

export function registerThemeColors(definitions: ThemeColorDefinition[]): () => void {
  const remove = addThemeColorDefinitions(definitions);
  for (const definition of definitions) applyThemeColor(definition);
  return () => {
    remove();
    for (const { key } of definitions) rootStyle.removeProperty(themeColorVar(key));
  };
}

registerThemeColors(BUILTIN_THEME_COLORS);
applyThemeColorScheme(loadThemeColorScheme(), false);

export function setThemeColors(overrides: ThemeColors): void {
  storeThemeColors({ ...themeColors(), ...overrides });
}

export function resetThemeColor(key: string): void {
  const next = { ...themeColors() };
  const presetValue = storedPreset().colors[key];
  if (presetValue === undefined) delete next[key];
  else next[key] = presetValue;
  storeThemeColors(next);
}

export function isThemeColorCustom(key: string): boolean {
  return themeColors()[key] !== storedPreset().colors[key];
}

function effectiveRawValue(key: string): string {
  return (
    themeColors()[key] ??
    themeColorDefinitions().find((definition) => definition.key === key)?.derive ??
    getComputedStyle(document.documentElement).getPropertyValue(themeColorVar(key)).trim()
  );
}

export function getEffectiveColor(key: string): string {
  return resolveThemeColorValue(effectiveRawValue(key));
}

export function getColorFormula(key: string): string {
  const raw = effectiveRawValue(key);
  return isColorRef(raw) ? raw : formatOklch(cssColorToOklch(resolveThemeColorValue(raw)));
}

export function getColorRef(key: string): ColorRef | undefined {
  return parseColorRef(effectiveRawValue(key));
}

export function setColorRef(key: string, ref: ColorRef): void {
  setThemeColors({ [key]: formatColorRef(ref) });
}

export function decoupleThemeColor(key: string): void {
  setThemeColors({ [key]: formatOklch(cssColorToOklch(getEffectiveColor(key))) });
}

export function copyableThemePalette(): string {
  return themeColorDefinitions()
    .map(({ key }) => `${key}=${formatOklch(cssColorToOklch(getEffectiveColor(key)))}`)
    .join("|");
}

export function applyCopiedThemePalette(payload: string): boolean {
  const known = new Set(themeColorDefinitions().map(({ key }) => key));
  const colors = payload
    .trim()
    .split("|")
    .map((pair) => pair.split("="))
    .filter(([key]) => known.has(defined(key)));
  if (colors.length === 0 || colors.some(([, value]) => !(value && CSS.supports("color", value))))
    return false;
  setThemeColors(Object.fromEntries(colors));
  return true;
}

export function applyPreset(preset: ThemePreset): void {
  setThemeColorsSignal(preset.colors);
  applyAllThemeColors();
  localStorage.setItem(THEME_PRESET_KEY, preset.id);
  localStorage.removeItem(THEME_COLORS_KEY);
  applyThemeColorScheme(preset.colorScheme ?? "dark", true);
}

function sameColor(a: string | undefined, b: string | undefined): boolean {
  return a?.trim().toLowerCase() === b?.trim().toLowerCase();
}

export function activePreset(): string {
  const colors = themeColors();
  const matches = (preset: ThemePreset) =>
    themeColorDefinitions().every(({ key, derive }) =>
      sameColor(colors[key] ?? derive, preset.colors[key] ?? derive),
    );
  return THEME_PRESETS.find(matches)?.id ?? "custom";
}
