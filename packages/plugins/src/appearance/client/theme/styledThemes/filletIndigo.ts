import { DARK_THEME_BASE } from "../themeBases";
import type { ThemePreset } from "../themePresets";
import { FILLET_CSS } from "./fillet";

export const FILLET_INDIGO: ThemePreset = {
  colors: {
    ...DARK_THEME_BASE,
    accent: "oklch(57% 0.17 277)",
    border: "@textPrimary 6%",
    borderStrong: "@textPrimary 12%",
    composerBg: "@mainBg 4%L",
    hoverBg: "@textPrimary 5%",
    mainBg: "oklch(16.5% 0.006 272)",
    mentionText: "oklch(76% 0.12 277)",
    railBg: "@sidebarBg",
    sidebarBg: "@mainBg -3%L",
    textDim: "@textPrimary -40%L",
    textOnAccent: "oklch(99% 0 0)",
    textPrimary: "oklch(95% 0.004 272)",
    textSecondary: "@textPrimary -27%L",
  },
  css: `${FILLET_CSS}
.app {
  padding: 8px 8px 8px 0;
}
hr.pane-divider {
  flex-basis: 8px;
}
.pane-row-tabbed {
  gap: 8px;
}
.pane-cell {
  box-shadow: 0 0 0 1px var(--border-strong), 0 2px 12px oklch(0 0 0 / 30%);
}
.channel-header {
  border-bottom: 1px solid var(--border);
}
.sidebar-section-header-btn {
  font-size: var(--font-size-meta);
  font-weight: 500;
  color: var(--text-dim);
}
.composer,
.composer:focus-within {
  box-shadow: inset 0 1px 0 rgb(from var(--text-primary) r g b / 6%);
}
`,
  id: "fillet-indigo",
  label: "Indigo",
};
