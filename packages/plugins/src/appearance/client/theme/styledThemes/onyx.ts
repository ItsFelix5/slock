import type { ThemePreset } from "../themePresets";

export const ONYX: ThemePreset = {
  colors: {
    accent: "@textPrimary",
    accentBorder: "@textPrimary 14%",
    accentBorderStrong: "@textPrimary 24%",
    accentEmphasis: "@textPrimary 13%",
    accentHover: "@accent -10%L",
    accentMuted: "@textPrimary 9%",
    accentSubtle: "@textPrimary 6%",
    activeBg: "@textPrimary 11%",
    badgeBg: "@danger -7.4%L 1%C",
    blockKitButtonDanger: "@badgeBg",
    blockKitButtonPrimary: "@presenceActive",
    border: "@textPrimary 5%",
    borderStrong: "@textPrimary 12%",
    codeBg: "@mainBg 7%L",
    composerBg: "@codeBg",
    controlContrastBorder: "@textPrimary 51%",
    danger: "oklch(69.96% 0.2136 22.03)",
    embeddedContentBg: "@codeBg",
    highlightBg: "@warningMuted",
    focusRingColor: "@mentionText",
    hoverBg: "@textPrimary 7%",
    mainBg: "oklch(0% 0 0)",
    mediaLensBorder: "@textPrimary 24%",
    mentionInaccessibleBg: "@hoverBg",
    mentionInaccessibleHoverBg: "@activeBg",
    mentionInaccessibleText: "@textSecondary",
    mentionSelfBg: "@warningSubtle",
    mentionSelfHoverBg: "@warningMuted",
    mentionText: "oklch(71.7% 0.1648 250.794)",
    overlayBackdrop: "@mainBg 80%",
    presenceActive: "oklch(64.58% 0.199 147.27)",
    scrimStrong: "@overlayBackdrop",
    shadowColor: "@mainBg 32%",
    shadowColorSoft: "@mainBg 16%",
    textDim: "@textPrimary -36%L",
    textOnAccent: "@codeBg",
    textOnDanger: "@textPrimary 6%L",
    textOnSuccess: "@textOnDanger",
    textPrimary: "oklch(93% 0 0)",
    textSecondary: "@textPrimary -23%L",
    warning: "oklch(77.21% 0.1991 64.28)",
    warningMuted: "@warning 20%",
    warningSubtle: "@warning 14%",
  },
  css: `
:root {
  --font-size-body: 14px;
  --font-size-secondary: 13px;
  --focus-ring-width: 2px;
  --focus-offset: 2px;
  --shadow-popover: 0 2px 2px var(--shadow-color), 0 8px 8px -8px var(--shadow-color-soft);
  --shadow-hovercard: var(--shadow-popover);
  --shadow-tooltip: var(--shadow-popover);
  --shadow-modal: 0 0 0 1px var(--border-strong), var(--shadow-popover);
  --shadow-modal-lg: var(--shadow-modal);
}
.sidebar-section-header-btn {
  font-size: var(--font-size-caption);
  font-weight: 500;
  letter-spacing: 0.02em;
}
.composer {
  border-color: var(--border-strong);
  box-shadow: none;
}
.field-surface:focus-within,
.text-field:focus-within {
  border-color: var(--accent-border-strong);
  box-shadow: none;
}
`,
  id: "onyx",
  label: "Onyx",
};
