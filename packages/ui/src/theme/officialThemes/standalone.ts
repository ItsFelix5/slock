import type { ThemeColors } from "../themeColorRegistry";
import type { ThemeFamily } from "../themePresets";
import { officialPreset, type Swatches } from "../themeSwatches";

const NORD: Swatches = {
  accent: "#88c0d0",
  bg: "#2e3440",
  danger: "#bf616a",
  link: "#81a1c1",
  onAccent: "#2e3440",
  success: "#a3be8c",
  text: "#eceff4",
  textDim: "@textPrimary -36%L 2.8%C",
  textSecondary: "#d8dee9",
  warning: "#ebcb8b",
};

const NORD_LAYERS: ThemeColors = {
  border: "@textSecondary 16%",
  borderStrong: "@textSecondary 22%",
  codeBg: "@mainBg -7.4%L",
  composerBg: "@mainBg 3.1%L",
  railBg: "@mainBg -3.7%L",
  sidebarBg: "@mainBg 5.5%L",
};

const DRACULA: Swatches = {
  accent: "#bd93f9",
  bg: "#282a36",
  danger: "#ff5555",
  link: "#8be9fd",
  onAccent: "#282a36",
  success: "#50fa7b",
  text: "#f8f8f2",
  textDim: "#6272a4",
  textSecondary: "@textPrimary 78%",
  warning: "#ffb86c",
};

const MONOKAI: Swatches = {
  accent: "#a6e22e",
  bg: "#272822",
  danger: "#f92672",
  link: "#66d9ef",
  onAccent: "#272822",
  success: "#a6e22e",
  text: "#f8f8f2",
  textDim: "#75715e",
  textSecondary: "#cfcfc2",
  warning: "#fd971f",
};

export const STANDALONE_FAMILIES: ThemeFamily[] = [
  {
    id: "nord",
    label: "Nord",
    presets: [officialPreset("nord", "Nord", "dark", NORD, NORD_LAYERS)],
    source: "https://www.nordtheme.com/docs/colors-and-palettes",
  },
  {
    id: "dracula",
    label: "Dracula",
    presets: [officialPreset("dracula", "Dracula", "dark", DRACULA)],
    source: "https://draculatheme.com/spec",
  },
  {
    id: "monokai",
    label: "Monokai",
    presets: [officialPreset("monokai", "Monokai", "dark", MONOKAI)],
    source:
      "https://github.com/sublimehq/Packages/blob/master/Color%20Scheme%20-%20Default/Monokai.sublime-color-scheme",
  },
];
