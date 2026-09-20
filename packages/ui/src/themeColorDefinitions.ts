export interface ThemeColors {
  accent?: string;
  accentBorder?: string;
  accentBorderStrong?: string;
  accentEmphasis?: string;
  accentHover?: string;
  accentMuted?: string;
  accentSubtle?: string;
  activeBg?: string;
  badgeBg?: string;
  blockKitButtonDanger?: string;
  blockKitButtonPrimary?: string;
  border?: string;
  borderStrong?: string;
  codeBg?: string;
  composerBg?: string;
  controlContrastBorder?: string;
  danger?: string;
  dangerMuted?: string;
  dangerSubtle?: string;
  embeddedContentBg?: string;
  errorBg?: string;
  errorText?: string;
  focusRingColor?: string;
  highlightBg?: string;
  hoverBg?: string;
  linkColor?: string;
  mainBg?: string;
  mediaLensBorder?: string;
  mentionBg?: string;
  mentionHoverBg?: string;
  mentionInaccessibleBg?: string;
  mentionInaccessibleHoverBg?: string;
  mentionInaccessibleText?: string;
  mentionSelfBg?: string;
  mentionSelfHoverBg?: string;
  mentionSelfText?: string;
  mentionText?: string;
  overlayBackdrop?: string;
  presenceActive?: string;
  presenceAway?: string;
  railBg?: string;
  scrimStrong?: string;
  shadowColor?: string;
  shadowColorSoft?: string;
  sidebarBg?: string;
  success?: string;
  textDim?: string;
  textOnAccent?: string;
  textOnAvatar?: string;
  textOnDanger?: string;
  textOnSuccess?: string;
  textDisabled?: string;
  textPrimary?: string;
  textSecondary?: string;
  userStatusBanned?: string;
  userStatusOver18?: string;
  userStatusUnverified?: string;
  warning?: string;
  warningEmphasis?: string;
  warningMuted?: string;
  warningSubtle?: string;
}

export interface ThemePreset {
  colorScheme?: "dark" | "light";
  colors: ThemeColors;
  id: string;
  label: string;
}

const THEME_COLOR_DEFINITIONS = {
  accent: ["--accent", "Accent"],
  accentBorder: ["--accent-border", "Accent border"],
  accentBorderStrong: ["--accent-border-strong", "Accent border (strong)"],
  accentEmphasis: ["--accent-emphasis", "Accent emphasis"],
  accentHover: ["--accent-hover", "Accent (hover)"],
  accentMuted: ["--accent-muted", "Accent muted"],
  accentSubtle: ["--accent-subtle", "Accent subtle"],
  activeBg: ["--active-bg", "Active background"],
  badgeBg: ["--badge-bg", "Badge background"],
  blockKitButtonDanger: ["--bk-button-danger", "Block Kit button (danger)"],
  blockKitButtonPrimary: ["--bk-button-primary", "Block Kit button (primary)"],
  border: ["--border", "Border"],
  borderStrong: ["--border-strong", "Border (strong)"],
  codeBg: ["--code-bg", "Code background"],
  composerBg: ["--composer-bg", "Composer background"],
  controlContrastBorder: ["--control-contrast-border", "Control contrast border"],
  danger: ["--danger", "Danger"],
  dangerMuted: ["--danger-muted", "Danger muted"],
  dangerSubtle: ["--danger-subtle", "Danger subtle"],
  embeddedContentBg: ["--embedded-content-bg", "Embedded content background"],
  errorBg: ["--error-bg", "Error background"],
  errorText: ["--error-text", "Error text"],
  focusRingColor: ["--focus-ring-color", "Focus ring"],
  highlightBg: ["--highlight-bg", "Highlight background"],
  hoverBg: ["--hover-bg", "Hover background"],
  linkColor: ["--link-color", "Link"],
  mainBg: ["--main-bg", "Main background"],
  mediaLensBorder: ["--media-lens-border", "Media lens border"],
  mentionBg: ["--mention-bg", "Mention background"],
  mentionHoverBg: ["--mention-hover-bg", "Mention background (hover)"],
  mentionInaccessibleBg: ["--mention-inaccessible-bg", "Mention inaccessible background"],
  mentionInaccessibleHoverBg: [
    "--mention-inaccessible-hover-bg",
    "Mention inaccessible background (hover)",
  ],
  mentionInaccessibleText: ["--mention-inaccessible-text", "Mention inaccessible text"],
  mentionSelfBg: ["--mention-self-bg", "Mention self background"],
  mentionSelfHoverBg: ["--mention-self-hover-bg", "Mention self background (hover)"],
  mentionSelfText: ["--mention-self-text", "Mention (self)"],
  mentionText: ["--mention-text", "Mention text"],
  overlayBackdrop: ["--overlay-backdrop", "Overlay backdrop"],
  presenceActive: ["--presence-active", "Presence (active)"],
  presenceAway: ["--presence-away", "Presence (away)"],
  railBg: ["--rail-bg", "Rail background"],
  scrimStrong: ["--scrim-strong", "Strong scrim"],
  shadowColor: ["--shadow-color", "Shadow"],
  shadowColorSoft: ["--shadow-color-soft", "Soft shadow"],
  sidebarBg: ["--sidebar-bg", "Sidebar background"],
  success: ["--success", "Success"],
  textDim: ["--text-dim", "Text (dim)"],
  textOnAccent: ["--text-on-accent", "Text on accent"],
  textOnAvatar: ["--text-on-avatar", "Text on avatar"],
  textOnDanger: ["--text-on-danger", "Text on danger"],
  textOnSuccess: ["--text-on-success", "Text on success"],
  textDisabled: ["--text-disabled", "Text (disabled)"],
  textPrimary: ["--text-primary", "Text (primary)"],
  textSecondary: ["--text-secondary", "Text (secondary)"],
  userStatusBanned: ["--user-status-banned", "User status (banned)"],
  userStatusOver18: ["--user-status-over-18", "User status (over 18)"],
  userStatusUnverified: ["--user-status-unverified", "User status (unverified)"],
  warning: ["--warning", "Warning"],
  warningEmphasis: ["--warning-emphasis", "Warning emphasis"],
  warningMuted: ["--warning-muted", "Warning muted"],
  warningSubtle: ["--warning-subtle", "Warning subtle"],
} satisfies Record<keyof ThemeColors, [string, string]>;

export const THEME_COLOR_KEYS = [
  "accent",
  "accentBorder",
  "accentBorderStrong",
  "accentEmphasis",
  "accentHover",
  "accentMuted",
  "accentSubtle",
  "activeBg",
  "badgeBg",
  "blockKitButtonDanger",
  "blockKitButtonPrimary",
  "border",
  "borderStrong",
  "codeBg",
  "composerBg",
  "controlContrastBorder",
  "danger",
  "dangerMuted",
  "dangerSubtle",
  "embeddedContentBg",
  "errorBg",
  "errorText",
  "focusRingColor",
  "highlightBg",
  "hoverBg",
  "linkColor",
  "mainBg",
  "mediaLensBorder",
  "mentionBg",
  "mentionHoverBg",
  "mentionInaccessibleBg",
  "mentionInaccessibleHoverBg",
  "mentionInaccessibleText",
  "mentionSelfBg",
  "mentionSelfHoverBg",
  "mentionSelfText",
  "mentionText",
  "overlayBackdrop",
  "presenceActive",
  "presenceAway",
  "railBg",
  "scrimStrong",
  "shadowColor",
  "shadowColorSoft",
  "sidebarBg",
  "success",
  "textDim",
  "textOnAccent",
  "textOnAvatar",
  "textOnDanger",
  "textOnSuccess",
  "textDisabled",
  "textPrimary",
  "textSecondary",
  "userStatusBanned",
  "userStatusOver18",
  "userStatusUnverified",
  "warning",
  "warningEmphasis",
  "warningMuted",
  "warningSubtle",
] as const satisfies readonly (keyof ThemeColors)[];

if (THEME_COLOR_KEYS.length !== Object.keys(THEME_COLOR_DEFINITIONS).length) {
  throw new Error("THEME_COLOR_KEYS is out of sync with THEME_COLOR_DEFINITIONS");
}

export function assertHasAllKeys<K extends string, V>(
  obj: Partial<Record<K, V>>,
  keys: readonly K[],
): asserts obj is Record<K, V> {
  for (const key of keys) {
    if (obj[key] === undefined) throw new Error(`theme color data missing for "${key}"`);
  }
}

const colorVars: Partial<Record<keyof ThemeColors, string>> = {};
const colorLabels: Partial<Record<keyof ThemeColors, string>> = {};
for (const key of THEME_COLOR_KEYS) {
  const [cssVar, label] = THEME_COLOR_DEFINITIONS[key];
  colorVars[key] = cssVar;
  colorLabels[key] = label;
}
assertHasAllKeys(colorVars, THEME_COLOR_KEYS);
assertHasAllKeys(colorLabels, THEME_COLOR_KEYS);

export const THEME_COLOR_VARS = colorVars;
export const THEME_COLOR_LABELS = colorLabels;

export function isThemeColorKey(key: string): key is keyof ThemeColors {
  return key in THEME_COLOR_VARS;
}

export const THEME_BASE_COLOR_KEYS = [
  "accent",
  "mainBg",
  "presenceActive",
  "danger",
  "warning",
  "textPrimary",
  "textOnAccent",
] as const satisfies readonly (keyof ThemeColors)[];

export type BaseColorKey = (typeof THEME_BASE_COLOR_KEYS)[number];
export type DerivedColorKey = Exclude<keyof ThemeColors, BaseColorKey>;

const BASE_KEY_SET = new Set<string>(THEME_BASE_COLOR_KEYS);

export const THEME_ADVANCED_COLOR_KEYS = THEME_COLOR_KEYS.filter(
  (key): key is DerivedColorKey => !BASE_KEY_SET.has(key),
);
