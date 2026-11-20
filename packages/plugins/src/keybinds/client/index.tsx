import type { Setup } from "@slock/core";
import { createKeybindOverrides, installKeybindOverrides, useShortcut } from "@slock/ui";
import { lazy } from "solid-js";

const view = lazy(() => import("./views/KeybindsTab"));

const setup: Setup = (ctx) => {
  const keybinds = createKeybindOverrides(localStorage);
  ctx.provide("keybinds", keybinds);
  ctx.onCleanup(installKeybindOverrides(keybinds));
  const settings = ctx.get("settings");
  ctx.add("settings.tab", { id: "keybinds", label: "Keybinds", view }, { order: 30 });
  useShortcut({
    allowInInputs: true,
    allowRepeat: false,
    combo: { key: "/", mod: true },
    group: "App",
    handler: () => settings.open("keybinds"),
    id: "general.showShortcuts",
    label: "Open keybind settings",
    scope: "general",
  });
};

export default setup;
