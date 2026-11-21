import type { Env, Setup } from "@slock/core";
import { createConcurrencyQueue } from "./concurrencyQueue";
import { createShortcutRegistry } from "./hooks/shortcutRegistry";
import type { EscapeLayer } from "./hooks/useEscapeClose";
import { createKeybindOverrides } from "./keybindOverrides";
import { createLayerStack } from "./layerStack";
import { createPaneNav } from "./nav/paneNav";
import { trackPageIdle } from "./pageIdle";

const BACKGROUND_FETCH_LIMIT = 4;

export function createUi(env: Env) {
  const keybinds = createKeybindOverrides(env.storage);
  const shortcuts = createShortcutRegistry(keybinds.overrides);
  const idle = trackPageIdle(env, document);
  return {
    backgroundFetchQueue: createConcurrencyQueue(BACKGROUND_FETCH_LIMIT),
    dispose() {
      keybinds.dispose();
      shortcuts.dispose();
      idle.dispose();
    },
    escapeLayers: createLayerStack<EscapeLayer>(),
    focusLayers: createLayerStack<object>(),
    keybinds,
    pageIdle: idle.idle,
    paneNav: createPaneNav(env),
    shortcuts,
  };
}

export type Ui = ReturnType<typeof createUi>;

export const provideUi: Setup = (ctx) => {
  const ui = createUi(ctx.get("env"));
  ctx.provide("ui", ui);
  ctx.onCleanup(ui.dispose);
};
