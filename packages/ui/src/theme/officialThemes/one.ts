import type { ThemeFamily } from "../themePresets";
import { officialPreset, type Swatches } from "../themeSwatches";

const DARK: Swatches = {
  accent: "#61afef",
  bg: "#282c34",
  danger: "#e06c75",
  link: "#56b6c2",
  onAccent: "#282c34",
  success: "#98c379",
  text: "#abb2bf",
  warning: "#e5c07b",
};

const LIGHT: Swatches = {
  accent: "#4078f2",
  bg: "#fafafa",
  danger: "#e45649",
  link: "#0184bc",
  onAccent: "#fafafa",
  success: "#50a14f",
  text: "#383a42",
  warning: "#c18401",
};

export const ONE: ThemeFamily = {
  id: "one",
  label: "One",
  presets: [
    officialPreset("one-dark", "Dark", "dark", DARK),
    officialPreset("one-light", "Light", "light", LIGHT),
  ],
  source: "https://github.com/atom/one-dark-syntax",
};
