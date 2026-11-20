import type { Setup } from "@slock/core";
import { getHost } from "@slock/core/solid";
import { createConfirmDialog, createFocusedPane, createWindowWidth } from "@slock/ui";
import { createSignal } from "solid-js";
import { createFeedback } from "./feedback";
import { createShellStore } from "./store";
import { createTitles } from "./titles";
import App from "./views/App";

const setup: Setup = (ctx) => {
  const defaults = ctx.use("shell.default");
  const readiness = ctx.use("shell.ready");
  const focusedPane = createFocusedPane();
  ctx.onCleanup(focusedPane.dispose);
  const windowWidth = createWindowWidth();
  ctx.onCleanup(windowWidth.dispose);
  const dialogs = createConfirmDialog();
  ctx.provide("shell.dialogs", dialogs);
  const store = createShellStore({
    defaultView: () => {
      for (const resolve of defaults()) {
        const view = resolve();
        if (view) return view;
      }
    },
    focusedPaneId: focusedPane.focusedPaneId,
    paneKinds: ctx.use("shell.pane"),
    ready: () => readiness().every((isReady) => isReady()),
  });
  ctx.provide("feedback", createFeedback());
  ctx.provide("titles", createTitles(ctx.use("shell.title")));
  ctx.provide("shell.panes", store.panes);
  ctx.provide("shell.view", store.viewState);
  const [startWidth, setStartWidth] = createSignal(0);
  ctx.provide("shell.layout", { setStartWidth, startWidth, windowWidth: windowWidth.width });
  void getHost()
    .idle()
    .then(() => store.viewState.start());
  ctx.add("root", App);
};

export default setup;
