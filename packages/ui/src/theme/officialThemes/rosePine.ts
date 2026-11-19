import type { ThemeFamily } from "../themePresets";
import { officialPreset, type Swatches } from "../themeSwatches";

interface Variant {
  base: string;
  foam: string;
  gold: string;
  iris: string;
  love: string;
  text: string;
}

const swatches = (v: Variant): Swatches => ({
  accent: v.iris,
  bg: v.base,
  danger: v.love,
  link: v.foam,
  onAccent: v.base,
  success: v.foam,
  text: v.text,
  warning: v.gold,
});

const MAIN: Variant = {
  base: "#191724",
  foam: "#9ccfd8",
  gold: "#f6c177",
  iris: "#c4a7e7",
  love: "#eb6f92",
  text: "#e0def4",
};

const MOON: Variant = { ...MAIN, base: "#232136" };

const DAWN: Variant = {
  base: "#faf4ed",
  foam: "#56949f",
  gold: "#ea9d34",
  iris: "#907aa9",
  love: "#b4637a",
  text: "#575279",
};

export const ROSE_PINE: ThemeFamily = {
  id: "rose-pine",
  label: "Rosé Pine",
  presets: [
    officialPreset("rose-pine", "Rosé Pine", "dark", swatches(MAIN)),
    officialPreset("rose-pine-moon", "Moon", "dark", swatches(MOON)),
    officialPreset("rose-pine-dawn", "Dawn", "light", swatches(DAWN)),
  ],
  source: "https://rosepinetheme.com/palette",
};
