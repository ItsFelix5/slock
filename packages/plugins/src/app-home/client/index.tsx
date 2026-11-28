import type { Setup } from "@slock/core";
import { installAppLinks } from "./openAppLinks";
import { createAppHomeStore } from "./store";
import AppHomeButton from "./views/AppHomeButton";
import AppHomeTakeover from "./views/AppHomeTakeover";

const setup: Setup = (ctx) => {
  const store = createAppHomeStore();
  ctx.provide("app-home", store);
  installAppLinks();
  ctx.add("conversations.opened", store.closeHome);
  ctx.add("messages.header", AppHomeButton, { order: 5 });
  ctx.add("messages.takeover", {
    active: (view) => store.homeChannelId() === view.id,
    view: AppHomeTakeover,
  });
};

export default setup;
