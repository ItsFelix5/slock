import { DARK_THEME_BASE } from "../themeBases";
import type { ThemePreset } from "../themePresets";

export const ISLANDS: ThemePreset = {
  colors: {
    ...DARK_THEME_BASE,
    accent: "oklch(0.84 0.17 125)",
    composerBg: "@mainBg 3%L",
    mainBg: "oklch(0.22 0.006 260)",
    railBg: "oklch(0.14 0.006 260)",
    sidebarBg: "oklch(0.19 0.006 260)",
    textOnAccent: "oklch(0.2 0.04 125)",
  },
  css: `
.app {
  gap: 8px;
  padding: 8px;
  background: var(--rail-bg);
}
.sidebar,
.pane-cell {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.sidebar-top {
  margin-top: 2px;
}
.pane-row {
  gap: 4px;
}
`,
  id: "islands",
  label: "Islands",
};
