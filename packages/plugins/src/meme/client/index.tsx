import type { Setup } from "@slock/core";
import { liveOnly } from "@slock/plugins/messages/client/api/deletedMessages";
import { createMemeStore } from "./store";
import MemeItem from "./views/MemeItem";
import MemeOverlay from "./views/MemeOverlay";

const setup: Setup = (ctx) => {
  ctx.provide("meme", createMemeStore());
  ctx.add("messages.menu", liveOnly(MemeItem), { order: 56 });
  ctx.add("shell.overlay", MemeOverlay);
};

export default setup;
