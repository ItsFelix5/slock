import { service } from "@slock/core/solid";
import { createEffect } from "solid-js";

const viewStore = service("conversations");
const titles = service("titles");

export function installDocumentTitle() {
  createEffect(() => {
    const view = viewStore.activeView();
    document.title = (view && titles.label(view.id)) || "slock";
  });
}
