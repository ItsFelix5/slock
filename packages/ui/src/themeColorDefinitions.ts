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
  font?: string;
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
  moderationBanned?: string;
  moderationRestricted?: string;
  moderationUnverified?: string;
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
  moderationBanned: ["--moderation-banned", "Moderation (banned)"],
  moderationRestricted: ["--moderation-restricted", "Moderation (restricted)"],
  moderationUnverified: ["--moderation-unverified", "Moderation (unverified)"],
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
  warning: ["--warning", "Warning"],
  warningEmphasis: ["--warning-emphasis", "Warning emphasis"],
  warningMuted: ["--warning-muted", "Warning muted"],
  warningSubtle: ["--warning-subtle", "Warning subtle"],
} satisfies Record<Exclude<keyof ThemeColors, "font">, [string, string]>;

export const THEME_COLOR_VARS = {
  font: "--font",
  ...Object.fromEntries(
    Object.entries(THEME_COLOR_DEFINITIONS).map(([key, [cssVar]]) => [key, cssVar]),
  ),
} as Record<keyof ThemeColors, string>;

export const THEME_COLOR_LABELS: Record<
  Exclude<keyof ThemeColors, "font">,
  string
> = Object.fromEntries(
  Object.entries(THEME_COLOR_DEFINITIONS).map(([key, [, label]]) => [key, label]),
) as Record<Exclude<keyof ThemeColors, "font">, string>;
