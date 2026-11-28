import type { ThemeColors } from "./themeColorRegistry";

export const DARK_THEME_BASE = {
  accent: "oklch(0.69 0.15 250)",
  accentHover: "@accent 6%L -2%C",
  badgeBg: "@danger -8%L 4%C",
  border: "@textSecondary 10%",
  borderStrong: "@textSecondary 18%",
  codeBg: "@mainBg -6%L -0.2%C 48%",
  composerBg: "@mainBg 3%L 0.1%C",
  danger: "oklch(0.74 0.13 25)",
  mainBg: "oklch(0.21 0.012 255)",
  mentionInaccessibleText: "@textDim 9%L",
  mentionText: "@accent 6%L -2%C",
  presenceActive: "oklch(0.66 0.14 155)",
  railBg: "@mainBg -2%L",
  sidebarBg: "@mainBg -4%L -0.1%C",
  textDim: "@textPrimary -37%L 0.4%C",
  textOnAccent: "oklch(0.17 0.011 255)",
  textOnAvatar: "@textPrimary 8%L",
  textPrimary: "oklch(0.89 0.006 255)",
  textSecondary: "@textPrimary -19%L 0.2%C",
  warning: "oklch(0.78 0.12 82)",
} satisfies ThemeColors;
