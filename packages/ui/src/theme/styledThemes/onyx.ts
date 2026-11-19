import type { ThemePreset } from "../themePresets";

export const ONYX: ThemePreset = {
  colors: {
    accent: "oklch(94.9% 0 0)",
    accentBorder: "@textPrimary 14%",
    accentBorderStrong: "@textPrimary 24%",
    accentEmphasis: "@textPrimary 13%",
    accentHover: "@accent -10%L",
    accentMuted: "@textPrimary 9%",
    accentSubtle: "@textPrimary 6%",
    activeBg: "@textPrimary 13%",
    badgeBg: "@danger -7.4%L 1%C",
    blockKitButtonDanger: "@badgeBg",
    blockKitButtonPrimary: "@presenceActive",
    border: "@textPrimary 4%",
    borderStrong: "@textPrimary 14%",
    codeBg: "@mainBg 18%L",
    composerBg: "@codeBg",
    controlContrastBorder: "@textPrimary 51%",
    danger: "oklch(69.96% 0.2136 22.03)",
    embeddedContentBg: "@codeBg",
    highlightBg: "@warningMuted",
    focusRingColor: "@mentionText",
    hoverBg: "@textPrimary 9%",
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
    textDim: "@textPrimary -30%L",
    textOnAccent: "@codeBg",
    textOnDanger: "@textPrimary 6%L",
    textOnSuccess: "@textOnDanger",
    textPrimary: "oklch(94.9% 0 0)",
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
.sidebar {
  border-right: 1px solid var(--border);
}
.channel-header {
  border-bottom: 1px solid var(--border);
}
.sidebar-section-header-btn {
  font-weight: 500;
  color: var(--text-secondary);
}
.sidebar-row.active,
.sidebar-nav-btn.active {
  background: var(--active-bg);
  color: var(--text-primary);
}
.composer {
  border-color: var(--border-strong);
  box-shadow: 0 1px 2px var(--shadow-color-soft);
  transition: border-color 100ms;
}
.composer:focus-within {
  border-color: var(--accent-border-strong);
  box-shadow: 0 1px 2px var(--shadow-color-soft);
}
`,
  id: "onyx",
  label: "Onyx",
};
