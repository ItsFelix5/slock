import type { ThemeColors } from "./themeColorDefinitions";

export function translucent(color: string, amount: number) {
  return `color-mix(in oklch, ${color} ${amount}%, transparent)`;
}

const DEPENDENT_THEME_COLOR_KEYS: Partial<Record<keyof ThemeColors, (keyof ThemeColors)[]>> = {
  accent: [
    "accentBorder",
    "accentBorderStrong",
    "accentEmphasis",
    "accentMuted",
    "accentSubtle",
    "focusRingColor",
    "moderationUnverified",
  ],
  danger: [
    "badgeBg",
    "blockKitButtonDanger",
    "dangerMuted",
    "dangerSubtle",
    "errorBg",
    "errorText",
    "moderationBanned",
  ],
  mentionInaccessibleText: ["mentionInaccessibleBg", "mentionInaccessibleHoverBg"],
  mentionSelfText: ["mentionSelfBg", "mentionSelfHoverBg"],
  mentionText: ["mentionBg", "mentionHoverBg"],
  presenceActive: ["blockKitButtonPrimary", "success"],
  textSecondary: ["controlContrastBorder"],
  warning: ["moderationRestricted", "warningEmphasis", "warningMuted", "warningSubtle"],
};

export function dependentThemeColorKeys(key: keyof ThemeColors): (keyof ThemeColors)[] {
  return DEPENDENT_THEME_COLOR_KEYS[key] ?? [];
}

export function withDerivedThemeColors(overrides: ThemeColors): ThemeColors {
  const derived: ThemeColors = {};
  if (overrides.accent !== undefined) {
    derived.accentBorder = translucent(overrides.accent, 52);
    derived.accentBorderStrong = translucent(overrides.accent, 82);
    derived.accentEmphasis = translucent(overrides.accent, 20);
    derived.accentMuted = translucent(overrides.accent, 14);
    derived.accentSubtle = translucent(overrides.accent, 8);
    derived.focusRingColor = overrides.accent;
    derived.moderationUnverified = overrides.accent;
  }
  if (overrides.danger !== undefined) {
    derived.badgeBg = overrides.danger;
    derived.blockKitButtonDanger = overrides.danger;
    derived.dangerMuted = translucent(overrides.danger, 12);
    derived.dangerSubtle = translucent(overrides.danger, 8);
    derived.errorBg = translucent(overrides.danger, 12);
    derived.errorText = overrides.danger;
    derived.moderationBanned = overrides.danger;
  }
  if (overrides.warning !== undefined) {
    derived.moderationRestricted = overrides.warning;
    derived.warningEmphasis = translucent(overrides.warning, 38);
    derived.warningMuted = translucent(overrides.warning, 18);
    derived.warningSubtle = translucent(overrides.warning, 8);
  }
  if (overrides.mentionText !== undefined) {
    derived.mentionBg = translucent(overrides.mentionText, 16);
    derived.mentionHoverBg = translucent(overrides.mentionText, 30);
  }
  if (overrides.mentionSelfText !== undefined) {
    derived.mentionSelfBg = translucent(overrides.mentionSelfText, 20);
    derived.mentionSelfHoverBg = translucent(overrides.mentionSelfText, 34);
  }
  if (overrides.mentionInaccessibleText !== undefined) {
    derived.mentionInaccessibleBg = translucent(overrides.mentionInaccessibleText, 14);
    derived.mentionInaccessibleHoverBg = translucent(overrides.mentionInaccessibleText, 24);
  }
  if (overrides.presenceActive !== undefined) {
    derived.blockKitButtonPrimary = overrides.presenceActive;
    derived.success = overrides.presenceActive;
  }
  if (overrides.textSecondary !== undefined)
    derived.controlContrastBorder = translucent(overrides.textSecondary, 42);
  return { ...derived, ...overrides };
}
