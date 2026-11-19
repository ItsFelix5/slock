import type { ThemeFamily } from "../themePresets";
import { officialPreset, type Swatches } from "../themeSwatches";

const DARK = {
  bg0Hard: "#1d2021",
  blue: "#83a598",
  fg1: "#ebdbb2",
  fg3: "#bdae93",
  gray: "#928374",
  green: "#b8bb26",
  red: "#fb4934",
  yellow: "#fabd2f",
  yellowNeutral: "#d79921",
};

const LIGHT = {
  bg0: "#fbf1c7",
  bg0Hard: "#f9f5d7",
  blue: "#076678",
  fg1: "#3c3836",
  fg3: "#665c54",
  fg4: "#7c6f64",
  green: "#79740e",
  red: "#9d0006",
  yellowFaded: "#b57614",
};

const dark = (bg: string): Swatches => ({
  accent: DARK.yellowNeutral,
  bg,
  danger: DARK.red,
  link: DARK.blue,
  onAccent: DARK.bg0Hard,
  success: DARK.green,
  text: DARK.fg1,
  textDim: DARK.gray,
  textSecondary: DARK.fg3,
  warning: DARK.yellow,
});

const light = (bg: string): Swatches => ({
  accent: LIGHT.yellowFaded,
  bg,
  danger: LIGHT.red,
  link: LIGHT.blue,
  onAccent: LIGHT.bg0,
  success: LIGHT.green,
  text: LIGHT.fg1,
  textDim: LIGHT.fg4,
  textSecondary: LIGHT.fg3,
  warning: LIGHT.yellowFaded,
});

export const GRUVBOX: ThemeFamily = {
  id: "gruvbox",
  label: "Gruvbox",
  presets: [
    officialPreset("gruvbox", "Dark", "dark", dark("#282828")),
    officialPreset("gruvbox-dark-hard", "Dark Hard", "dark", dark(DARK.bg0Hard)),
    officialPreset("gruvbox-dark-soft", "Dark Soft", "dark", dark("#32302f")),
    officialPreset("gruvbox-light", "Light", "light", light(LIGHT.bg0)),
    officialPreset("gruvbox-light-hard", "Light Hard", "light", light(LIGHT.bg0Hard)),
    officialPreset("gruvbox-light-soft", "Light Soft", "light", light("#f2e5bc")),
  ],
  source: "https://github.com/morhetz/gruvbox",
};
