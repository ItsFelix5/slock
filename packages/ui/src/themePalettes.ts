import type { ThemePreset } from "./themePresets";

interface Palette {
  accent: string;
  danger: string;
  id: string;
  label: string;
  mainBg: string;
  mention: string;
  success: string;
  text: string;
  warning: string;
}

const shared = (p: Palette) => ({
  accent: p.accent,
  accentHover: "@accent 6%L -2%C",
  badgeBg: "@danger",
  blockKitButtonDanger: "@badgeBg",
  blockKitButtonPrimary: "@presenceActive",
  danger: p.danger,
  mainBg: p.mainBg,
  mentionText: p.mention,
  presenceActive: p.success,
  textOnAccent: "@mainBg",
  textPrimary: p.text,
  warning: p.warning,
});

const dark = (p: Palette): ThemePreset => ({
  colors: {
    ...shared(p),
    activeBg: "@textPrimary 12%",
    border: "@textSecondary 12%",
    borderStrong: "@textSecondary 22%",
    codeBg: "@mainBg -4%L",
    composerBg: "@mainBg 3%L",
    hoverBg: "@textPrimary 7%",
    railBg: "@mainBg -3%L",
    sidebarBg: "@mainBg -1.5%L",
    textDim: "@textPrimary -22%L",
    textSecondary: "@textPrimary -11%L",
  },
  id: p.id,
  label: p.label,
});

const light = (p: Palette): ThemePreset => ({
  colorScheme: "light",
  colors: {
    ...shared(p),
    activeBg: "@accent 14%",
    border: "@textPrimary 12%",
    borderStrong: "@textPrimary 22%",
    codeBg: "@textPrimary 6%",
    composerBg: "@mainBg 2%L",
    embeddedContentBg: "@composerBg",
    hoverBg: "@textPrimary 6%",
    mediaLensBorder: "@composerBg 88%",
    railBg: "@mainBg -4%L",
    sidebarBg: "@mainBg -2%L",
    textDim: "@textPrimary 20%L",
    textOnAvatar: "@mainBg",
    textOnDanger: "@mainBg",
    textOnSuccess: "@mainBg",
    textSecondary: "@textPrimary 11%L",
  },
  id: p.id,
  label: p.label,
});

const parse = (row: string): Palette => {
  const [id = "", label = "", mainBg = "", text = "", ...rest] = row.split("|");
  const [accent = "", danger = "", success = "", warning = "", mention = ""] = rest;
  return { accent, danger, id, label, mainBg, mention, success, text, warning };
};

const DARK_ROWS = [
  "dracula|Dracula|#282a36|#f8f8f2|#bd93f9|#ff5555|#50fa7b|#f1fa8c|#8be9fd",
  "tokyo-night|Tokyo Night|#1a1b26|#c0caf5|#7aa2f7|#f7768e|#9ece6a|#e0af68|#7dcfff",
  "rose-pine|Rose Pine|#191724|#e0def4|#c4a7e7|#eb6f92|#9ccfd8|#f6c177|#ebbcba",
  "solarized-dark|Solarized Dark|#002b36|#c4d0d0|#4aa3e0|#dc322f|#859900|#b58900|#2aa198",
  "one-dark|One Dark|#282c34|#c0c7d3|#61afef|#e06c75|#98c379|#e5c07b|#c678dd",
  "monokai|Monokai|#272822|#f8f8f2|#a6e22e|#f92672|#a6e22e|#e6db74|#66d9ef",
  "everforest|Everforest|#2d353b|#d3c6aa|#a7c080|#e67e80|#a7c080|#dbbc7f|#7fbbb3",
  "kanagawa|Kanagawa|#1f1f28|#dcd7ba|#7e9cd8|#e46876|#98bb6c|#e6c384|#957fb8",
  "ayu-mirage|Ayu Mirage|#1f2430|#cccac2|#ffcc66|#f28779|#d5ff80|#ffad66|#73d0ff",
  "synthwave|Synthwave|#262335|#f4eeff|#ff7edb|#fe4450|#72f1b8|#fede5d|#36f9f6",
  "ocean|Ocean|#0f111a|#a6accd|#82aaff|#ff5370|#c3e88d|#ffcb6b|#89ddff",
  "horizon|Horizon|#1c1e26|#cbced0|#e95378|#ec6a88|#29d398|#fab795|#25b0bc",
  "coffee|Coffee|#1e1a17|#e8d9c5|#d08c60|#d9644a|#9fb46a|#e0b25a|#e0a77a",
  "matrix|Matrix|#020a04|#b6ffc4|#00ff6a|#ff4d4d|#00ff6a|#e6ff4d|#4dffd2",
  "oled|OLED|#000000|#e6e6e6|#8ab4ff|#ff6b6b|#5ddc8a|#ffd166|#8ab4ff",
];

const LIGHT_ROWS = [
  "solarized-light|Solarized Light|#fdf6e3|#073642|#1a6fa8|#dc322f|#859900|#8a6700|#1a6fa8",
  "catppuccin-latte|Catppuccin Latte|#eff1f5|#3d4058|#7c2fe0|#d20f39|#40a02b|#a8650a|#1a56d6",
  "rose-pine-dawn|Rose Pine Dawn|#faf4ed|#3a3459|#6f5a8a|#b4637a|#56949f|#a8650f|#9a4a47",
  "gruvbox-light|Gruvbox Light|#fbf1c7|#3c3836|#8f5a0c|#cc241d|#79740e|#9a6a00|#076678",
  "github-light|GitHub Light|#ffffff|#1f2328|#0969da|#cf222e|#1a7f37|#9a6700|#0969da",
  "nord-snow|Nord Snow|#eceff4|#2e3440|#44668f|#bf616a|#6f9a5b|#a8512f|#44668f",
];

export const PALETTE_PRESETS: ThemePreset[] = [
  ...DARK_ROWS.map((row) => dark(parse(row))),
  ...LIGHT_ROWS.map((row) => light(parse(row))),
];
