import type { Env, Setup } from "@slock/core";
import { createShortcutRegistry } from "./hooks/shortcutRegistry";
import type { EscapeLayer } from "./hooks/useEscapeClose";
import { createKeybindOverrides } from "./keybindOverrides";
import { createLayerStack } from "./layerStack";
import { LENS_SHORTCUTS, VIDEO_SHORTCUTS } from "./media/mediaShortcuts";
import { createPaneNav } from "./nav/paneNav";
import { trackPageIdle } from "./pageIdle";

export function createUi(env: Env) {
  const keybinds = createKeybindOverrides(env.storage);
  const focusLayers = createLayerStack<object>();
  const shortcuts = createShortcutRegistry(keybinds.overrides, () => !focusLayers.isEmpty());
  const idle = trackPageIdle(env, document);
  return {
    dispose() {
      keybinds.dispose();
      shortcuts.dispose();
      idle.dispose();
    },
    escapeLayers: createLayerStack<EscapeLayer>(),
    focusLayers,
    keybinds,
    pageIdle: idle.idle,
    paneNav: createPaneNav(env),
    shortcuts,
  };
}

export type Ui = ReturnType<typeof createUi>;

export const provideUi: Setup = (ctx) => {
  const ui = createUi(ctx.get("env"));
  ui.shortcuts.declare([...Object.values(VIDEO_SHORTCUTS), ...Object.values(LENS_SHORTCUTS)]);
  ctx.provide("ui", ui);
  ctx.onCleanup(ui.dispose);
};
