import { DARK_THEME_BASE } from "../themeBases";
import type { ThemePreset } from "../themePresets";

export const FILLET_CSS = `
.app {
  padding: 6px;
  background: var(--sidebar-bg);
}
.sidebar {
  border-right: 0;
}
.pane-cell {
  border-radius: var(--radius-lg);
  box-shadow: 0 0 0 1px var(--border);
}
hr.pane-divider {
  flex-basis: 6px;
}
.pane-row-tabbed {
  gap: 6px;
}
hr.pane-divider::after {
  left: 2px;
  width: 2px;
  border-radius: var(--radius-pill);
  background: transparent;
}
`;

export const FILLET: ThemePreset = {
  colors: {
    ...DARK_THEME_BASE,
    accent: "oklch(0.76 0.12 195)",
    composerBg: "@mainBg 3%L",
    mainBg: "oklch(0.25 0.016 215)",
    textDim: "@textPrimary -33%L 0.4%C",
    railBg: "@mainBg -12%L",
    sidebarBg: "@mainBg -12%L",
    textOnAccent: "oklch(0.17 0.02 215)",
  },
  css: FILLET_CSS,
  id: "fillet",
  label: "Fillet",
};
