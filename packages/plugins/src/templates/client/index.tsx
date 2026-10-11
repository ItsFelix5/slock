import type { Setup } from "@slock/core";
import { lazy } from "solid-js";
import { createTemplatesStore } from "./store";

const view = lazy(() => import("./views/TemplatesTab"));

const setup: Setup = (ctx) => {
  const templates = createTemplatesStore();
  ctx.provide("templates", templates);
  ctx.add(
    "settings.tab",
    { id: "templates", label: "Templates", view, visible: () => templates.templates().length > 0 },
    { order: 40 },
  );
};

export default setup;
