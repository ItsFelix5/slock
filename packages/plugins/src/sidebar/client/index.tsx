import type { Setup } from "@slock/core";
import { focusPaneById } from "@slock/ui";
import { useCycleShortcuts } from "./cycleShortcuts";
import { createSidebarStore } from "./store";
import Sidebar from "./views/Sidebar";

const setup: Setup = (ctx) => {
  const layout = ctx.get("shell.layout");
  const items = ctx.use("sidebar.nav");
  ctx.provide(
    "sidebar",
    createSidebarStore(
      (id) => !!items().find((item) => item.id === id)?.hidden,
      () => focusPaneById("sidebar"),
    ),
  );
  useCycleShortcuts();
  ctx.add("shell.start", () => <Sidebar onWidth={layout.setStartWidth} />, { order: 0 });
  ctx.onCleanup(() => layout.setStartWidth(0));
};

export default setup;
