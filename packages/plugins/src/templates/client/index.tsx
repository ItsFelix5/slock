import type { Setup } from "@slock/core";
import { lazyChunk } from "@slock/core/solid";

import { createTemplatesStore } from "./store";

const view = lazyChunk(() => import("./views/TemplatesTab"));

const setup: Setup = (ctx) => {
  const templates = createTemplatesStore();
  ctx.provide("templates", templates);
  ctx.add(
    "settings.tab",
    { id: "templates", label: "Templates", view, visible: () => templates.templates().length > 0 },
    { order: 40 },
  );
  ctx.add("composer.draftAction", {
    icon: "bookmark",
    label: "Save as template",
    namePlaceholder: "Template name",
    save: (name, { blocks, files }) => templates.saveTemplate(name, blocks, files),
  });
};

export default setup;
