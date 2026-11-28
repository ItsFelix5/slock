import type { Setup } from "@slock/core";
import { lazyChunk } from "@slock/core/solid";
import { createEffect, untrack } from "solid-js";
import { createTheme } from "./theme/createTheme";

const view = lazyChunk(() => import("./views/AppearanceTab"));

const setup: Setup = (ctx) => {
  const theme = createTheme(ctx.get("env").storage);
  ctx.onCleanup(theme.dispose);
  ctx.provide("theme", theme);
  const colors = ctx.use("appearance.colors");
  createEffect(
    () => colors(),
    (groups) => {
      const removers = untrack(() => groups.map(theme.registerThemeColors));
      return () => {
        for (const remove of removers) remove();
      };
    },
  );
  ctx.add("settings.tab", { id: "appearance", label: "Appearance", view }, { order: 20 });
};

export default setup;
