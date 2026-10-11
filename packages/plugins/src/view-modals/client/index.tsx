import type { Setup } from "@slock/core";
import { createModalsSlice } from "./store";
import ViewModal from "./views/ViewModal";

const setup: Setup = (ctx) => {
  const store = createModalsSlice();
  ctx.provide("view-modals", store);
  ctx.add("realtime.handler", {
    run: (event) => {
      if (event.type !== "view_opened" && event.type !== "view_updated") return;
      if (event.view_type !== "modal" || !event.view) return;
      if (event.type === "view_opened") store.openView(event.view);
      else store.updateView(event.view);
    },
    types: ["view_opened", "view_updated"],
  });
  ctx.add("shell.overlay", ViewModal);
};

export default setup;
