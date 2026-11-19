import type { ThemeFamily } from "../themePresets";
import { officialPreset, type Swatches } from "../themeSwatches";

const WAVE: Swatches = {
  accent: "#7e9cd8",
  bg: "#1f1f28",
  danger: "#e46876",
  link: "#7fb4ca",
  onAccent: "#1f1f28",
  success: "#98bb6c",
  text: "#dcd7ba",
  warning: "#e6c384",
};

const DRAGON: Swatches = {
  accent: "#8ba4b0",
  bg: "#181616",
  danger: "#c4746e",
  link: "#949fb5",
  onAccent: "#181616",
  success: "#87a987",
  text: "#c5c9c5",
  warning: "#c4b28a",
};

export const KANAGAWA: ThemeFamily = {
  id: "kanagawa",
  label: "Kanagawa",
  presets: [
    officialPreset("kanagawa", "Wave", "dark", WAVE),
    officialPreset("kanagawa-dragon", "Dragon", "dark", DRAGON),
  ],
  source: "https://github.com/rebelot/kanagawa.nvim",
};
