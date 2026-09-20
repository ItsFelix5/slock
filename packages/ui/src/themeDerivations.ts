import type { DerivedColorKey, ThemeColors } from "./themeColorDefinitions";
import { isThemeColorKey, THEME_COLOR_VARS } from "./themeColorDefinitions";

export function translucent(color: string, amount: number) {
  return `rgb(from ${color} r g b / ${amount}%)`;
}

export function channelShift(color: string, deltaL?: number, deltaC?: number) {
  const l = deltaL === undefined ? "l" : `calc(l + ${deltaL / 100})`;
  const c = deltaC === undefined ? "c" : `calc(c + ${deltaC / 100})`;
  return `oklch(from ${color} ${l} ${c} h)`;
}

const REF_PATTERN = /^@([a-zA-Z]+)((?:\s+[+-]?\d+(?:\.\d+)?%[LC]?)*)$/;
const TERM_PATTERN = /([+-]?\d+(?:\.\d+)?)%([LC]?)/g;

export function isColorRef(value: string): boolean {
  return REF_PATTERN.test(value.trim());
}

export function colorRefToCss(ref: string): string {
  const match = REF_PATTERN.exec(ref.trim());
  if (!(match && isThemeColorKey(match[1]))) return ref;
  const [, source, termsRaw] = match;
  let expr = `var(${THEME_COLOR_VARS[source]})`;
  let deltaL: number | undefined;
  let deltaC: number | undefined;
  let alpha: number | undefined;
  for (const [, amount, unit] of termsRaw.matchAll(TERM_PATTERN)) {
    if (unit === "L") deltaL = Number(amount);
    else if (unit === "C") deltaC = Number(amount);
    else alpha = Number(amount);
  }
  if (deltaL !== undefined || deltaC !== undefined) expr = channelShift(expr, deltaL, deltaC);
  return alpha === undefined ? expr : translucent(expr, alpha);
}

export function resolveThemeColorValue(value: string): string {
  return isColorRef(value) ? colorRefToCss(value) : value;
}

export const DERIVED_COLOR_REFS: Record<DerivedColorKey, string> = {
  accentBorder: "@accent 52%",
  accentBorderStrong: "@accent 82%",
  accentEmphasis: "@accent 20%",
  accentHover: "@accent 6%L -2%C",
  accentMuted: "@accent 14%",
  accentSubtle: "@accent 8%",
  activeBg: "@textPrimary 10%",
  badgeBg: "@danger -8%L 4%C",
  blockKitButtonDanger: "@badgeBg -8%L",
  blockKitButtonPrimary: "@presenceActive -8%L",
  border: "@textSecondary 10%",
  borderStrong: "@textSecondary 18%",
  codeBg: "@mainBg -6%L -0.2%C 48%",
  composerBg: "@mainBg 3%L 0.1%C",
  controlContrastBorder: "@textSecondary 42%",
  dangerMuted: "@danger 12%",
  dangerSubtle: "@danger 8%",
  embeddedContentBg: "@textOnAvatar",
  errorBg: "@danger 12%",
  errorText: "@danger",
  focusRingColor: "@accent",
  highlightBg: "@warning 28%",
  hoverBg: "@textPrimary 6%",
  linkColor: "@mentionText",
  mediaLensBorder: "@textOnAvatar 88%",
  mentionBg: "@mentionText 16%",
  mentionHoverBg: "@mentionText 30%",
  mentionInaccessibleBg: "@mentionInaccessibleText 14%",
  mentionInaccessibleHoverBg: "@mentionInaccessibleText 24%",
  mentionInaccessibleText: "@textDim",
  mentionSelfBg: "@mentionSelfText 20%",
  mentionSelfHoverBg: "@mentionSelfText 34%",
  mentionSelfText: "@warning",
  mentionText: "@accent 6%L -2%C",
  overlayBackdrop: "@codeBg 68%",
  presenceAway: "@textDim",
  railBg: "@mainBg -2%L",
  scrimStrong: "@codeBg 72%",
  shadowColor: "@codeBg 72%",
  shadowColorSoft: "@codeBg 48%",
  sidebarBg: "@mainBg -4%L -0.1%C",
  success: "@presenceActive 8%L",
  textDim: "@textPrimary -37%L 0.4%C",
  textDisabled: "@textDim",
  textOnAvatar: "@textPrimary",
  textOnDanger: "@codeBg 100%",
  textOnSuccess: "@codeBg 100%",
  textSecondary: "@textPrimary -19%L 0.2%C",
  userStatusBanned: "@badgeBg",
  userStatusOver18: "@warning -8%L",
  userStatusUnverified: "@accent",
  warningEmphasis: "@warning 38%",
  warningMuted: "@warning 18%",
  warningSubtle: "@warning 8%",
};

export function isDerivedColorKey(key: keyof ThemeColors): key is DerivedColorKey {
  return key in DERIVED_COLOR_REFS;
}
