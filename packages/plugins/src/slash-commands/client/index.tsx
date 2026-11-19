import type { Setup } from "@slock/core";
import { createSlashCommandsStore } from "./store";

const setup: Setup = (ctx) => {
  const store = createSlashCommandsStore();
  ctx.provide("slash-commands", store);
  ctx.add("realtime.handler", { run: store.invalidate, types: ["commands_changed"] });
};

export default setup;
