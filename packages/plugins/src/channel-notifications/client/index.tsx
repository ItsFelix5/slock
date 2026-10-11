import type { Setup } from "@slock/core";
import NotificationsMenu from "./views/NotificationsMenu";

const setup: Setup = (ctx) => {
  ctx.add("messages.channelMenu", NotificationsMenu, { order: 40 });
};

export default setup;
