import type { ThemeColors } from "../themeColorRegistry";
import type { ThemeFamily } from "../themePresets";
import { officialPreset, type Swatches } from "../themeSwatches";

interface Flavor {
  base: string;
  blue: string;
  green: string;
  mauve: string;
  overlay1: string;
  overlay2: string;
  red: string;
  subtext0: string;
  text: string;
  yellow: string;
}

const swatches = (f: Flavor, light: boolean): Swatches => ({
  accent: f.mauve,
  bg: f.base,
  danger: f.red,
  link: f.blue,
  onAccent: f.base,
  success: f.green,
  text: f.text,
  textDim: light ? f.overlay2 : f.overlay1,
  textSecondary: f.subtext0,
  warning: f.yellow,
});

const LATTE: Flavor = {
  base: "#eff1f5",
  blue: "#1e66f5",
  green: "#40a02b",
  mauve: "#8839ef",
  overlay1: "#8c8fa1",
  overlay2: "#7c7f93",
  red: "#d20f39",
  subtext0: "#6c6f85",
  text: "#4c4f69",
  yellow: "#df8e1d",
};

const FRAPPE: Flavor = {
  base: "#303446",
  blue: "#8caaee",
  green: "#a6d189",
  mauve: "#ca9ee6",
  overlay1: "#838ba7",
  overlay2: "#949cbb",
  red: "#e78284",
  subtext0: "#a5adce",
  text: "#c6d0f5",
  yellow: "#e5c890",
};

const MACCHIATO: Flavor = {
  base: "#24273a",
  blue: "#8aadf4",
  green: "#a6da95",
  mauve: "#c6a0f6",
  overlay1: "#8087a2",
  overlay2: "#939ab7",
  red: "#ed8796",
  subtext0: "#a5adcb",
  text: "#cad3f5",
  yellow: "#eed49f",
};

const MOCHA: Flavor = {
  base: "#1e1e2e",
  blue: "#89b4fa",
  green: "#a6e3a1",
  mauve: "#cba6f7",
  overlay1: "#7f849c",
  overlay2: "#9399b2",
  red: "#f38ba8",
  subtext0: "#a6adc8",
  text: "#cdd6f4",
  yellow: "#f9e2af",
};

const DEEP_LAYERS: ThemeColors = {
  border: "@textSecondary 16%",
  borderStrong: "@textSecondary 32%",
  codeBg: "@mainBg -6%L",
  composerBg: "@mainBg -2.7%L",
  railBg: "@mainBg -6%L",
  sidebarBg: "@mainBg -2.7%L",
};

export const CATPPUCCIN: ThemeFamily = {
  id: "catppuccin",
  label: "Catppuccin",
  presets: [
    officialPreset("catppuccin", "Mocha", "dark", swatches(MOCHA, false), DEEP_LAYERS),
    officialPreset(
      "catppuccin-macchiato",
      "Macchiato",
      "dark",
      swatches(MACCHIATO, false),
      DEEP_LAYERS,
    ),
    officialPreset("catppuccin-frappe", "Frappé", "dark", swatches(FRAPPE, false), DEEP_LAYERS),
    officialPreset("catppuccin-latte", "Latte", "light", swatches(LATTE, true)),
  ],
  source: "https://catppuccin.com/palette",
};
