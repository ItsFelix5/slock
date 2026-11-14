import type { Setup } from "@slock/core";
import { lazy } from "solid-js";
import {
  invalidateSlashCommandSuggestions,
  resetSlashCommandSuggestions,
} from "./lib/commands/slashCommandSuggestions";
import { clearAllPendingFiles } from "./lib/pendingFiles";
import FileInput from "./views/FileInput";

const Composer = lazy(() => import("./views/Composer"));
const RichTextInput = lazy(() => import("./views/RichTextInput"));

const setup: Setup = (ctx) => {
  void Composer.preload();
  ctx.onCleanup(resetSlashCommandSuggestions);
  ctx.onCleanup(clearAllPendingFiles);
  ctx.add("composer.input", Composer);
  ctx.add("blockkit.fileInput", FileInput);
  ctx.add("blockkit.richTextInput", RichTextInput);
  ctx.add("realtime.handler", {
    run: invalidateSlashCommandSuggestions,
    types: ["commands_changed"],
  });
};

export default setup;
