import type { ThemeFamily } from "../themePresets";
import { officialPreset, type Swatches } from "../themeSwatches";

const LIGHT: Swatches = {
  accent: "#0969da",
  bg: "#ffffff",
  danger: "#cf222e",
  link: "#0969da",
  onAccent: "#ffffff",
  success: "#1a7f37",
  text: "#1f2328",
  textDim: "#8c959f",
  textSecondary: "#656d76",
  warning: "#9a6700",
};

const DARK: Swatches = {
  accent: "#1f6feb",
  bg: "#0d1117",
  danger: "#f85149",
  link: "#2f81f7",
  onAccent: "#ffffff",
  success: "#3fb950",
  text: "#e6edf3",
  textDim: "#6e7681",
  textSecondary: "#7d8590",
  warning: "#d29922",
};

const DIMMED: Swatches = {
  accent: "#316dca",
  bg: "#22272e",
  danger: "#e5534b",
  link: "#539bf5",
  onAccent: "#ffffff",
  success: "#57ab5a",
  text: "#adbac7",
  textDim: "#636e7b",
  textSecondary: "#768390",
  warning: "#c69026",
};

export const GITHUB: ThemeFamily = {
  id: "github",
  label: "GitHub",
  presets: [
    officialPreset("github-dark", "Dark", "dark", DARK),
    officialPreset("github-dark-dimmed", "Dark Dimmed", "dark", DIMMED),
    officialPreset("github-light", "Light", "light", LIGHT),
  ],
  source: "https://github.com/primer/github-vscode-theme",
};
