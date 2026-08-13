import type { ThemeColors, ThemePreset } from "./themeColors";
import { translucent } from "./themeDerivations";

type ThemeBaseColors = ThemeColors &
  Required<
    Pick<
      ThemeColors,
      | "accent"
      | "accentHover"
      | "activeBg"
      | "badgeBg"
      | "border"
      | "borderStrong"
      | "codeBg"
      | "composerBg"
      | "danger"
      | "hoverBg"
      | "linkColor"
      | "mainBg"
      | "mentionSelfText"
      | "mentionText"
      | "presenceActive"
      | "railBg"
      | "sidebarBg"
      | "textDim"
      | "textOnAccent"
      | "textPrimary"
      | "textSecondary"
      | "warning"
    >
  >;

type CompleteThemeColors = Required<Omit<ThemeColors, "font">>;

function completeTheme(colors: ThemeBaseColors): CompleteThemeColors {
  const {
    accent,
    codeBg,
    danger,
    mentionSelfText,
    mentionText,
    textDim,
    textPrimary,
    textSecondary,
    warning,
  } = colors;
  const textOnAvatar = colors.textOnAvatar ?? textPrimary;
  const mentionInaccessibleText = colors.mentionInaccessibleText ?? textDim;

  return {
    ...colors,
    accentBorder: colors.accentBorder ?? translucent(accent, 52),
    accentBorderStrong: colors.accentBorderStrong ?? translucent(accent, 82),
    accentEmphasis: colors.accentEmphasis ?? translucent(accent, 20),
    accentMuted: colors.accentMuted ?? translucent(accent, 14),
    accentSubtle: colors.accentSubtle ?? translucent(accent, 8),
    blockKitButtonDanger: colors.blockKitButtonDanger ?? danger,
    blockKitButtonPrimary: colors.blockKitButtonPrimary ?? colors.presenceActive,
    controlContrastBorder: colors.controlContrastBorder ?? translucent(textSecondary, 42),
    dangerMuted: colors.dangerMuted ?? translucent(danger, 12),
    dangerSubtle: colors.dangerSubtle ?? translucent(danger, 8),
    embeddedContentBg: colors.embeddedContentBg ?? textOnAvatar,
    errorBg: colors.errorBg ?? translucent(danger, 12),
    errorText: colors.errorText ?? danger,
    focusRingColor: colors.focusRingColor ?? accent,
    highlightBg: colors.highlightBg ?? translucent(warning, 28),
    mediaLensBorder: colors.mediaLensBorder ?? translucent(textOnAvatar, 88),
    mentionBg: colors.mentionBg ?? translucent(mentionText, 16),
    mentionHoverBg: colors.mentionHoverBg ?? translucent(mentionText, 30),
    mentionInaccessibleBg: colors.mentionInaccessibleBg ?? translucent(mentionInaccessibleText, 14),
    mentionInaccessibleHoverBg:
      colors.mentionInaccessibleHoverBg ?? translucent(mentionInaccessibleText, 24),
    mentionInaccessibleText,
    mentionSelfBg: colors.mentionSelfBg ?? translucent(mentionSelfText, 20),
    mentionSelfHoverBg: colors.mentionSelfHoverBg ?? translucent(mentionSelfText, 34),
    moderationBanned: colors.moderationBanned ?? colors.badgeBg,
    moderationRestricted: colors.moderationRestricted ?? warning,
    moderationUnverified: colors.moderationUnverified ?? accent,
    overlayBackdrop: colors.overlayBackdrop ?? translucent(codeBg, 68),
    presenceAway: colors.presenceAway ?? textDim,
    scrimStrong: colors.scrimStrong ?? translucent(codeBg, 72),
    shadowColor: colors.shadowColor ?? translucent(codeBg, 72),
    shadowColorSoft: colors.shadowColorSoft ?? translucent(codeBg, 48),
    success: colors.success ?? colors.presenceActive,
    textDisabled: colors.textDisabled ?? textDim,
    textOnAvatar,
    textOnDanger: colors.textOnDanger ?? codeBg,
    textOnSuccess: colors.textOnSuccess ?? codeBg,
    warningEmphasis: colors.warningEmphasis ?? translucent(warning, 38),
    warningMuted: colors.warningMuted ?? translucent(warning, 18),
    warningSubtle: colors.warningSubtle ?? translucent(warning, 8),
  };
}

const DARK_THEME_BASE = {
  accent: "oklch(0.69 0.15 250)",
  accentHover: "oklch(0.75 0.13 250)",
  activeBg: "color-mix(in oklch, oklch(0.89 0.006 255) 10%, transparent)",
  badgeBg: "oklch(0.66 0.17 25)",
  blockKitButtonDanger: "oklch(0.58 0.18 25)",
  blockKitButtonPrimary: "oklch(0.58 0.14 155)",
  border: "color-mix(in oklch, oklch(0.7 0.008 255) 10%, transparent)",
  borderStrong: "color-mix(in oklch, oklch(0.7 0.008 255) 18%, transparent)",
  codeBg: "color-mix(in oklch, oklch(0.15 0.01 255) 48%, transparent)",
  composerBg: "oklch(0.24 0.013 255)",
  danger: "oklch(0.74 0.13 25)",
  embeddedContentBg: "oklch(0.97 0.003 255)",
  hoverBg: "color-mix(in oklch, oklch(0.89 0.006 255) 6%, transparent)",
  linkColor: "oklch(0.75 0.13 250)",
  mainBg: "oklch(0.21 0.012 255)",
  mediaLensBorder: "color-mix(in oklch, oklch(0.97 0.003 255) 88%, transparent)",
  mentionInaccessibleText: "oklch(0.61 0.009 255)",
  mentionSelfText: "oklch(0.78 0.12 82)",
  mentionText: "oklch(0.75 0.13 250)",
  moderationRestricted: "oklch(0.7 0.14 82)",
  overlayBackdrop: "color-mix(in oklch, oklch(0.15 0.01 255) 68%, transparent)",
  presenceActive: "oklch(0.66 0.14 155)",
  railBg: "oklch(0.19 0.012 255)",
  scrimStrong: "color-mix(in oklch, oklch(0.15 0.01 255) 72%, transparent)",
  shadowColor: "color-mix(in oklch, oklch(0.15 0.01 255) 72%, transparent)",
  shadowColorSoft: "color-mix(in oklch, oklch(0.15 0.01 255) 48%, transparent)",
  sidebarBg: "oklch(0.17 0.011 255)",
  success: "oklch(0.74 0.12 155)",
  textDim: "oklch(0.52 0.01 255)",
  textDisabled: "oklch(0.425 0.011 255)",
  textOnAccent: "oklch(0.17 0.011 255)",
  textOnAvatar: "oklch(0.97 0.003 255)",
  textOnDanger: "oklch(0.15 0.01 255)",
  textOnSuccess: "oklch(0.15 0.01 255)",
  textPrimary: "oklch(0.89 0.006 255)",
  textSecondary: "oklch(0.7 0.008 255)",
  warning: "oklch(0.78 0.12 82)",
} satisfies ThemeColors;

export const DARK_THEME_COLORS = completeTheme(DARK_THEME_BASE);

export const LIGHT_THEME_COLORS = completeTheme({
  ...DARK_THEME_BASE,
  accent: "oklch(0.56 0.15 250)",
  accentHover: "oklch(0.49 0.15 250)",
  activeBg: "color-mix(in oklch, oklch(0.56 0.15 250) 12%, transparent)",
  badgeBg: "oklch(0.54 0.18 25)",
  blockKitButtonDanger: "oklch(0.54 0.18 25)",
  blockKitButtonPrimary: "oklch(0.52 0.14 155)",
  border: "color-mix(in oklch, oklch(0.175 0.01 255) 10%, transparent)",
  borderStrong: "color-mix(in oklch, oklch(0.175 0.01 255) 18%, transparent)",
  codeBg: "color-mix(in oklch, oklch(0.105 0.008 255) 6%, transparent)",
  composerBg: "oklch(0.995 0.001 255)",
  danger: "oklch(0.54 0.18 25)",
  embeddedContentBg: "oklch(0.995 0.001 255)",
  hoverBg: "color-mix(in oklch, oklch(0.175 0.01 255) 5%, transparent)",
  linkColor: "oklch(0.54 0.15 250)",
  mainBg: "oklch(0.985 0.002 255)",
  mediaLensBorder: "color-mix(in oklch, oklch(0.995 0.001 255) 88%, transparent)",
  mentionSelfText: "oklch(0.52 0.13 82)",
  mentionText: "oklch(0.54 0.15 250)",
  mentionInaccessibleText: "oklch(0.55 0.01 255)",
  moderationBanned: "oklch(0.54 0.18 25)",
  moderationRestricted: "oklch(0.52 0.13 82)",
  moderationUnverified: "oklch(0.56 0.15 250)",
  overlayBackdrop: "color-mix(in oklch, oklch(0.105 0.008 255) 48%, transparent)",
  presenceActive: "oklch(0.52 0.14 155)",
  railBg: "oklch(0.95 0.004 255)",
  scrimStrong: "color-mix(in oklch, oklch(0.105 0.008 255) 64%, transparent)",
  shadowColor: "color-mix(in oklch, oklch(0.105 0.008 255) 24%, transparent)",
  shadowColorSoft: "color-mix(in oklch, oklch(0.105 0.008 255) 14%, transparent)",
  sidebarBg: "oklch(0.965 0.003 255)",
  success: "oklch(0.52 0.14 155)",
  textDim: "oklch(0.5 0.01 255)",
  textDisabled: "oklch(0.6 0.009 255)",
  textOnAccent: "oklch(0.985 0.002 255)",
  textOnAvatar: "oklch(0.985 0.002 255)",
  textOnDanger: "oklch(0.985 0.002 255)",
  textOnSuccess: "oklch(0.985 0.002 255)",
  textPrimary: "oklch(0.2 0.01 255)",
  textSecondary: "oklch(0.4 0.011 255)",
  warning: "oklch(0.52 0.13 82)",
});

const tintedTheme = (hue: number, accent: string, accentHover: string): ThemeColors =>
  completeTheme({
    ...DARK_THEME_BASE,
    accent,
    accentHover,
    composerBg: `oklch(0.215 0.016 ${hue})`,
    mainBg: `oklch(0.18 0.014 ${hue})`,
    railBg: `oklch(0.145 0.012 ${hue})`,
    sidebarBg: `oklch(0.11 0.01 ${hue})`,
  });

const catppuccinMocha = completeTheme({
  accent: "#cba6f7",
  accentHover: "#b4befe",
  activeBg: translucent("#cdd6f4", 12),
  badgeBg: "#f38ba8",
  border: "#45475a",
  borderStrong: "#585b70",
  codeBg: "color-mix(in oklch, #11111b 82%, black)",
  composerBg: "#313244",
  danger: "#f38ba8",
  hoverBg: translucent("#cdd6f4", 7),
  linkColor: "#89b4fa",
  mainBg: "#1e1e2e",
  mentionSelfText: "#f9e2af",
  mentionText: "#89b4fa",
  presenceActive: "#a6e3a1",
  railBg: "#11111b",
  sidebarBg: "#181825",
  textDim: "#6c7086",
  textOnAccent: "#11111b",
  textPrimary: "#cdd6f4",
  textSecondary: "#bac2de",
  warning: "#f9e2af",
});

const gruvbox = completeTheme({
  accent: "#d79921",
  accentHover: "#fabd2f",
  activeBg: translucent("#ebdbb2", 12),
  badgeBg: "#cc241d",
  border: "#504945",
  borderStrong: "#665c54",
  codeBg: "color-mix(in oklch, #1d2021 82%, black)",
  composerBg: "#3c3836",
  danger: "#fb4934",
  hoverBg: translucent("#ebdbb2", 7),
  linkColor: "#83a598",
  mainBg: "#282828",
  mentionSelfText: "#fabd2f",
  mentionText: "#83a598",
  presenceActive: "#b8bb26",
  railBg: "#1d2021",
  sidebarBg: "#32302f",
  textDim: "#928374",
  textOnAccent: "#1d2021",
  textPrimary: "#ebdbb2",
  textSecondary: "#a89984",
  warning: "#fabd2f",
});

const nord = completeTheme({
  accent: "#88c0d0",
  accentHover: "#8fbcbb",
  activeBg: translucent("#eceff4", 12),
  badgeBg: "#bf616a",
  border: "#434c5e",
  borderStrong: "#4c566a",
  codeBg: "color-mix(in oklch, #2e3440 65%, black)",
  composerBg: "#353c4a",
  danger: "#bf616a",
  hoverBg: translucent("#eceff4", 7),
  linkColor: "#88c0d0",
  mainBg: "#2e3440",
  mentionSelfText: "#ebcb8b",
  mentionText: "#88c0d0",
  presenceActive: "#a3be8c",
  railBg: "color-mix(in oklch, #2e3440 82%, black)",
  sidebarBg: "#3b4252",
  textDim: "#4c566a",
  textOnAccent: "#2e3440",
  textPrimary: "#eceff4",
  textSecondary: "#d8dee9",
  warning: "#ebcb8b",
});

export const THEME_PRESETS: ThemePreset[] = [
  { colors: DARK_THEME_COLORS, id: "dark", label: "Charcoal" },
  { colorScheme: "light", colors: LIGHT_THEME_COLORS, id: "light", label: "Porcelain" },
  {
    colors: tintedTheme(310, "oklch(0.68 0.14 310)", "oklch(0.75 0.11 310)"),
    id: "aubergine",
    label: "Aubergine",
  },
  {
    colors: tintedTheme(175, "oklch(0.69 0.12 175)", "oklch(0.77 0.1 175)"),
    id: "forest",
    label: "Forest",
  },
  {
    colors: tintedTheme(350, "oklch(0.68 0.16 350)", "oklch(0.75 0.13 350)"),
    id: "crimson",
    label: "Crimson",
  },
  {
    colors: tintedTheme(48, "oklch(0.7 0.15 48)", "oklch(0.78 0.12 48)"),
    id: "sunset",
    label: "Sunset",
  },
  {
    colors: tintedTheme(275, "oklch(0.69 0.12 275)", "oklch(0.77 0.09 275)"),
    id: "slate",
    label: "Slate",
  },
  {
    colors: catppuccinMocha,
    id: "catppuccin",
    label: "Catppuccin Mocha",
  },
  {
    colors: gruvbox,
    id: "gruvbox",
    label: "Gruvbox",
  },
  {
    colors: nord,
    id: "nord",
    label: "Nord",
  },
];
