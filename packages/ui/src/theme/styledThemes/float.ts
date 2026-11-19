import { DARK_THEME_BASE } from "../themeBases";
import type { ThemePreset } from "../themePresets";

export const FLOAT: ThemePreset = {
  colors: {
    ...DARK_THEME_BASE,
    accent: "oklch(0.8 0.1 65)",
    composerBg: "@mainBg 4%L",
    mainBg: "oklch(0.2 0.006 70)",
    sidebarBg: "@mainBg -2.5%L",
    textOnAccent: "oklch(0.2 0.03 65)",
  },
  css: `
:root {
  --veil-blur: blur(14px) saturate(1.3);
  --veil-fill: rgb(from var(--main-bg) r g b / 58%);
}
.message-list,
.composer-overlay {
  --message-row-inline-start: max(16px, calc((100% - 760px) / 2));
  --message-row-inline-end: max(16px, calc((100% - 760px) / 2));
  --composer-frame-inline: max(16px, calc((100% - 760px) / 2));
}
.sidebar {
  border-right: 0;
}
.channel-header {
  position: absolute;
  inset: 0 0 auto;
  z-index: 3;
  padding-inline: max(16px, calc((100% - 760px) / 2));
  overflow: visible;
  background: none;
  border-bottom: 0;
}
.composer-overlay {
  background: none;
}
.channel-header::before,
.composer-overlay::before {
  content: "";
  position: absolute;
  z-index: -1;
  pointer-events: none;
  background: var(--veil-fill);
  backdrop-filter: var(--veil-blur);
}
.channel-header::before {
  inset: 0 0 -24px;
  mask-image: linear-gradient(to bottom, #000 60%, transparent);
}
.composer-overlay::before {
  inset: -32px 0 0;
  mask-image: linear-gradient(to top, #000 60%, transparent);
}
.message-list,
.conversation-pane:not(:has(.message-list)) {
  padding-top: calc(var(--header-height) + 8px);
}
.popover-root.message-list-date-nav {
  top: calc(var(--header-height) + 12px);
}
.composer-frame {
  box-shadow: 0 6px 20px oklch(0 0 0 / 24%);
}
.menu-panel,
.surface-popover:not(.composer-frame) {
  background: rgb(from var(--composer-bg) r g b / 72%);
  backdrop-filter: blur(20px) saturate(1.5);
  border-color: rgb(from var(--text-primary) r g b / 10%);
  box-shadow: 0 4px 16px oklch(0 0 0 / 28%);
}
`,
  id: "float",
  label: "Float",
};
