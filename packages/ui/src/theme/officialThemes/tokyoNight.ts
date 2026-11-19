import type { ThemeFamily } from "../themePresets";
import { officialPreset, type Swatches } from "../themeSwatches";

const NIGHT: Swatches = {
  accent: "#7aa2f7",
  bg: "#1a1b26",
  danger: "#f7768e",
  link: "#7dcfff",
  onAccent: "#1a1b26",
  success: "#9ece6a",
  text: "#c0caf5",
  textDim: "#737aa2",
  textSecondary: "#a9b1d6",
  warning: "#e0af68",
};

const STORM: Swatches = {
  ...NIGHT,
  bg: "#24283b",
  onAccent: "#24283b",
};

const MOON: Swatches = {
  accent: "#82aaff",
  bg: "#222436",
  danger: "#ff757f",
  link: "#86e1fc",
  onAccent: "#222436",
  success: "#c3e88d",
  text: "#c8d3f5",
  textDim: "#636da6",
  textSecondary: "#828bb8",
  warning: "#ffc777",
};

const DAY: Swatches = {
  accent: "#2e7de9",
  bg: "#e1e2e7",
  danger: "#f52a65",
  link: "#007197",
  onAccent: "#e1e2e7",
  success: "#587539",
  text: "#3760bf",
  textDim: "#68709a",
  textSecondary: "#6172b0",
  warning: "#8c6c3e",
};

export const TOKYO_NIGHT: ThemeFamily = {
  id: "tokyo-night",
  label: "Tokyo Night",
  presets: [
    officialPreset("tokyo-night", "Night", "dark", NIGHT),
    officialPreset("tokyo-night-storm", "Storm", "dark", STORM),
    officialPreset("tokyo-night-moon", "Moon", "dark", MOON),
    officialPreset("tokyo-night-day", "Day", "light", DAY),
  ],
  source: "https://github.com/folke/tokyonight.nvim",
};
