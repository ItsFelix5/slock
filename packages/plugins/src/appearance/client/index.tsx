import type { Setup } from "@slock/core";
import { lazy } from "solid-js";

const view = lazy(() => import("./views/AppearanceTab"));

const setup: Setup = (ctx) => {
  ctx.add("settings.tab", { id: "appearance", label: "Appearance", view }, { order: 20 });
};

export default setup;
