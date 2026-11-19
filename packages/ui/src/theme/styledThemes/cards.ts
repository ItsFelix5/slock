import { DARK_THEME_BASE } from "../themeBases";
import type { ThemePreset } from "../themePresets";

export const CARDS: ThemePreset = {
  colors: {
    ...DARK_THEME_BASE,
    accent: "oklch(0.82 0.13 85)",
    composerBg: "@mainBg 4%L",
    mainBg: "oklch(0.2 0.03 255)",
    railBg: "@mainBg -4%L",
    sidebarBg: "@mainBg -4%L",
    textOnAccent: "oklch(0.2 0.03 85)",
  },
  css: `
.message-list {
  --message-row-padding-y: 8px;
  padding-top: 8px;
}
.message-row-group {
  margin: 6px 12px;
  background: var(--composer-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.message-row-group:hover {
  border-color: var(--border-strong);
}
`,
  id: "cards",
  label: "Cards",
};
