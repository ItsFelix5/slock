import type { ThemePreset } from "../themePresets";

export const GRAPHITE: ThemePreset = {
  colors: {
    accent: "oklch(0.72 0.19 50)",
    accentHover: "@accent 5%L",
    activeBg: "@textPrimary 12%",
    badgeBg: "oklch(0.62 0.22 28)",
    border: "oklch(0.33 0.003 90)",
    borderStrong: "oklch(0.45 0.004 90)",
    codeBg: "oklch(0.16 0.002 90)",
    composerBg: "oklch(0.19 0.002 90)",
    danger: "oklch(0.7 0.19 28)",
    hoverBg: "@textPrimary 6%",
    mainBg: "oklch(0.235 0.002 90)",
    mentionText: "oklch(0.8 0.1 200)",
    presenceActive: "oklch(0.78 0.18 140)",
    railBg: "oklch(0.15 0.002 90)",
    sidebarBg: "oklch(0.195 0.002 90)",
    textDim: "oklch(0.62 0.004 90)",
    textOnAccent: "oklch(0.14 0 0)",
    textPrimary: "oklch(0.93 0.004 90)",
    textSecondary: "oklch(0.78 0.004 90)",
    warning: "oklch(0.82 0.15 90)",
  },
  css: `
:root {
  --font-size-body: 14px;
  --font-size-secondary: 13px;
  --shadow-popover: 0 0 0 1px var(--border-strong), 0 8px 20px rgb(0 0 0 / 50%);
  --shadow-hovercard: var(--shadow-popover);
  --shadow-modal: 0 0 0 1px var(--border-strong), 0 16px 40px rgb(0 0 0 / 60%);
  --shadow-modal-lg: var(--shadow-modal);
}
.sidebar {
  box-shadow: inset -1px 0 0 rgb(255 255 255 / 4%);
}
  
.sidebar {
  border-right-color: var(--border-strong);
}
.channel-header {
  border-bottom-color: var(--border-strong);
}
.sidebar-section-header-btn {
  font-size: var(--font-size-caption);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.sidebar-row {
  margin-inline: 0;
  width: 100%;
}
.sidebar-row.active {
  background: var(--hover-bg);
  box-shadow: inset 3px 0 0 var(--accent);
}
.sidebar-nav-btn.active {
  color: var(--text-on-accent);
  background: var(--accent);
}
.composer:focus-within {
  border-color: var(--accent);
  box-shadow: none;
}
.message-author {
  letter-spacing: 0.02em;
}`,
  id: "graphite",
  label: "Graphite",
};
