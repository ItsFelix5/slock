import type { ThemeFamily } from "../themePresets";
import { officialPreset, type Swatches } from "../themeSwatches";

const MIRAGE: Swatches = {
  accent: "#ffcc66",
  bg: "#1f2430",
  danger: "#ff6666",
  link: "#73d0ff",
  onAccent: "#1f2430",
  success: "#d5ff80",
  text: "#cccac2",
  textDim: "#707a8c",
  textSecondary: "@textPrimary 75%",
  warning: "#ffad66",
};

const DARK: Swatches = {
  accent: "#e6b450",
  bg: "#0b0e14",
  danger: "#d95757",
  link: "#59c2ff",
  onAccent: "#0b0e14",
  success: "#aad94c",
  text: "#bfbdb6",
  textDim: "#565b66",
  textSecondary: "@textPrimary 75%",
  warning: "#ff8f40",
};

export const AYU: ThemeFamily = {
  id: "ayu",
  label: "Ayu",
  presets: [
    officialPreset("ayu-mirage", "Mirage", "dark", MIRAGE),
    officialPreset("ayu-dark", "Dark", "dark", DARK),
  ],
  source: "https://github.com/ayu-theme/ayu-colors",
};
