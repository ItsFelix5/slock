import { defined } from "@slock/core";
import { cssColorToOklch, formatOklch } from "../form/color/oklchColor";
import { createImmediateSignal } from "../immediateSignal";
import { BUILTIN_THEME_COLORS } from "./themeColorBuiltins";
import {
  createThemeColorRegistry,
  type ThemeColorDefinition,
  type ThemeColors,
  themeColorVar,
} from "./themeColorRegistry";
import {
  type ColorRef,
  formatColorRef,
  isColorRef,
  parseColorRef,
  resolveThemeColorValue,
} from "./themeDerivations";
import type { ThemePrefs } from "./themePrefs";
import { THEME_PRESETS, type ThemePreset } from "./themePresets";

export type { ThemeColorDefinition } from "./themeColorRegistry";

export function storedPreset(pref: ThemePrefs["preset"]): ThemePreset {
  const id = pref.get();
  return THEME_PRESETS.find((preset) => preset.id === id) ?? defined(THEME_PRESETS[0]);
}

function applyThemeColorScheme(scheme: "dark" | "light") {
  document.documentElement.dataset.colorScheme = scheme;
}

function sameColor(a: string | undefined, b: string | undefined): boolean {
  return a?.trim().toLowerCase() === b?.trim().toLowerCase();
}

export interface ThemeColorsDeps {
  setFont: (font: string) => void;
  setThemeCss: (css: string) => void;
}

export function createThemeColors(deps: ThemeColorsDeps, prefs: ThemePrefs) {
  const preset = () => storedPreset(prefs.preset);
  const rootStyle = document.documentElement.style;
  const registry = createThemeColorRegistry();
  const { themeColorDefinitions } = registry;
  const [themeColors, setThemeColorsSignal] = createImmediateSignal<ThemeColors>({
    ...preset().colors,
    ...prefs.colors.get(),
  });
  const isKnown = (key: string) => themeColorDefinitions().some((def) => def.key === key);
  const resolve = (value: string) => resolveThemeColorValue(value, isKnown);

  function applyThemeColor({ key, derive }: ThemeColorDefinition) {
    const value = themeColors()[key] ?? derive;
    if (value === undefined) rootStyle.removeProperty(themeColorVar(key));
    else rootStyle.setProperty(themeColorVar(key), resolve(value));
  }

  function applyAllThemeColors() {
    for (const definition of themeColorDefinitions()) applyThemeColor(definition);
  }

  function storeThemeColors(colors: ThemeColors) {
    setThemeColorsSignal(colors);
    prefs.colors.set(colors);
    applyAllThemeColors();
  }

  function registerThemeColors(definitions: ThemeColorDefinition[]): () => void {
    const remove = registry.add(definitions);
    for (const definition of definitions) applyThemeColor(definition);
    return () => {
      remove();
      for (const { key } of definitions) rootStyle.removeProperty(themeColorVar(key));
    };
  }

  const removeBuiltins = registerThemeColors(BUILTIN_THEME_COLORS);
  applyThemeColorScheme(preset().colorScheme ?? "dark");

  function setThemeColors(overrides: ThemeColors): void {
    storeThemeColors({ ...themeColors(), ...overrides });
  }

  function effectiveRawValue(key: string): string {
    return (
      themeColors()[key] ??
      themeColorDefinitions().find((definition) => definition.key === key)?.derive ??
      getComputedStyle(document.documentElement).getPropertyValue(themeColorVar(key)).trim()
    );
  }

  function getEffectiveColor(key: string): string {
    return resolve(effectiveRawValue(key));
  }

  return {
    activePreset(): string {
      const colors = themeColors();
      const matches = (preset: ThemePreset) =>
        themeColorDefinitions().every(({ key, derive }) =>
          sameColor(colors[key] ?? derive, preset.colors[key] ?? derive),
        );
      return THEME_PRESETS.find(matches)?.id ?? "custom";
    },
    applyCopiedThemePalette(payload: string): boolean {
      const known = new Set(themeColorDefinitions().map(({ key }) => key));
      const colors = payload
        .trim()
        .split("|")
        .map((pair) => pair.split("="))
        .filter(([key]) => known.has(defined(key)));
      if (
        colors.length === 0 ||
        colors.some(([, value]) => !(value && CSS.supports("color", value)))
      )
        return false;
      setThemeColors(Object.fromEntries(colors));
      return true;
    },
    applyPreset(next: ThemePreset): void {
      setThemeColorsSignal(next.colors);
      applyAllThemeColors();
      prefs.preset.set(next.id);
      prefs.colors.reset();
      applyThemeColorScheme(next.colorScheme ?? "dark");
      deps.setThemeCss(next.css ?? "");
      if (next.font) deps.setFont(next.font);
    },
    copyableThemePalette(): string {
      return themeColorDefinitions()
        .map(({ key }) => `${key}=${formatOklch(cssColorToOklch(getEffectiveColor(key)))}`)
        .join("|");
    },
    decoupleThemeColor(key: string): void {
      setThemeColors({ [key]: formatOklch(cssColorToOklch(getEffectiveColor(key))) });
    },
    dispose: removeBuiltins,
    getColorFormula(key: string): string {
      const raw = effectiveRawValue(key);
      return isColorRef(raw) ? raw : formatOklch(cssColorToOklch(resolve(raw)));
    },
    getColorRef: (key: string): ColorRef | undefined => parseColorRef(effectiveRawValue(key)),
    getEffectiveColor,
    isThemeColorCustom: (key: string): boolean => themeColors()[key] !== preset().colors[key],
    registerThemeColors,
    resetThemeColor(key: string): void {
      const next = { ...themeColors() };
      const presetValue = preset().colors[key];
      if (presetValue === undefined) delete next[key];
      else next[key] = presetValue;
      storeThemeColors(next);
    },
    setColorRef: (key: string, ref: ColorRef): void =>
      setThemeColors({ [key]: formatColorRef(ref) }),
    setThemeColors,
    themeColorDefinitions,
  };
}
