import type { Setup } from "@slock/core";
import { createSlashCommandsStore } from "./store";

const setup: Setup = (ctx) => {
  ctx.provide("slash-commands", createSlashCommandsStore());
};

export default setup;
