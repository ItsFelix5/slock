import type { Setup } from "@slock/core";
import { lazy } from "solid-js";
import { definePluginSettings } from "../../plugins/client/api";
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
  const setting = definePluginSettings(ctx, {
    uploadOnAttach: { default: false, label: "Start uploading when a file is attached" },
  });
  ctx.provide("composer", { uploadOnAttach: setting("uploadOnAttach") });
  ctx.add("composer.input", Composer);
  ctx.add("blockkit.fileInput", FileInput);
  ctx.add("blockkit.richTextInput", RichTextInput);
  ctx.add("realtime.handler", {
    run: invalidateSlashCommandSuggestions,
    types: ["commands_changed"],
  });
};

export default setup;
