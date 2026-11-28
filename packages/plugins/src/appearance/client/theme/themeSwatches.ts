import type { ThemeColors } from "./themeColorRegistry";
import type { ThemePreset } from "./themePresets";

export interface Swatches {
  accent: string;
  bg: string;
  danger: string;
  link: string;
  onAccent: string;
  success: string;
  text: string;
  textDim?: string;
  textSecondary?: string;
  warning: string;
}

const shared = (s: Swatches): ThemeColors => ({
  accent: s.accent,
  badgeBg: "@danger",
  blockKitButtonDanger: "@badgeBg",
  blockKitButtonPrimary: "@presenceActive",
  danger: s.danger,
  mainBg: s.bg,
  mentionText: s.link,
  presenceActive: s.success,
  textOnAccent: s.onAccent,
  textPrimary: s.text,
  warning: s.warning,
});

const darkColors = (s: Swatches): ThemeColors => ({
  ...shared(s),
  accentHover: "@accent 6%L -2%C",
  activeBg: "@textPrimary 12%",
  border: "@textSecondary 14%",
  borderStrong: "@textSecondary 26%",
  codeBg: "@mainBg -4%L",
  composerBg: "@mainBg 3%L",
  hoverBg: "@textPrimary 7%",
  railBg: "@mainBg -3.5%L",
  sidebarBg: "@mainBg -2%L",
  textDim: s.textDim ?? "@textPrimary -22%L",
  textSecondary: s.textSecondary ?? "@textPrimary -11%L",
});

const lightColors = (s: Swatches): ThemeColors => ({
  ...shared(s),
  accentHover: "@accent -7%L",
  activeBg: "@accent 16%",
  border: "@textPrimary 12%",
  borderStrong: "@textPrimary 22%",
  codeBg: "@textPrimary 6%",
  composerBg: "@mainBg 2%L",
  embeddedContentBg: "@composerBg",
  hoverBg: "@textPrimary 6%",
  mediaLensBorder: "@composerBg 88%",
  railBg: "@mainBg -4%L",
  sidebarBg: "@mainBg -2%L",
  textDim: s.textDim ?? "@textPrimary 20%L",
  textOnAvatar: "@mainBg",
  textOnDanger: "@mainBg",
  textOnSuccess: "@mainBg",
  textSecondary: s.textSecondary ?? "@textPrimary 11%L",
});

export function officialPreset(
  id: string,
  label: string,
  scheme: "dark" | "light",
  swatches: Swatches,
  layers: ThemeColors = {},
): ThemePreset {
  return scheme === "light"
    ? {
        colorScheme: "light",
        colors: { ...lightColors(swatches), ...layers },
        id,
        label,
      }
    : { colors: { ...darkColors(swatches), ...layers }, id, label };
}
