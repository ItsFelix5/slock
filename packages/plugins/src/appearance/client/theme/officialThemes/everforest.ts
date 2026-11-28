import type { ThemeFamily } from "../themePresets";
import { officialPreset, type Swatches } from "../themeSwatches";

const DARK: Swatches = {
  accent: "#a7c080",
  bg: "#2d353b",
  danger: "#e67e80",
  link: "#7fbbb3",
  onAccent: "#2d353b",
  success: "#a7c080",
  text: "#d3c6aa",
  textDim: "#859289",
  textSecondary: "#9da9a0",
  warning: "#dbbc7f",
};

const LIGHT: Swatches = {
  accent: "#8da101",
  bg: "#fdf6e3",
  danger: "#f85552",
  link: "#3a94c5",
  onAccent: "#fdf6e3",
  success: "#35a77c",
  text: "#5c6a72",
  textDim: "#829181",
  textSecondary: "@textPrimary 80%",
  warning: "#dfa000",
};

export const EVERFOREST: ThemeFamily = {
  id: "everforest",
  label: "Everforest",
  presets: [
    officialPreset("everforest", "Dark", "dark", DARK),
    officialPreset("everforest-light", "Light", "light", LIGHT),
  ],
  source: "https://github.com/sainnhe/everforest",
};
