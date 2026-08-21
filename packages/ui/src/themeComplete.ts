import type { ThemeColors } from "./themeColorDefinitions";
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

export function completeTheme(colors: ThemeBaseColors): CompleteThemeColors {
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
