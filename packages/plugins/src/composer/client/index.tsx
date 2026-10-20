import type { Setup } from "@slock/core";
import {
  invalidateSlashCommandSuggestions,
  resetSlashCommandSuggestions,
} from "./lib/commands/slashCommandSuggestions";
import { clearAllPendingFiles } from "./lib/pendingFiles";
import Composer from "./views/Composer";
import RichTextInput from "./views/RichTextInput";

const setup: Setup = (ctx) => {
  ctx.onCleanup(resetSlashCommandSuggestions);
  ctx.onCleanup(clearAllPendingFiles);
  ctx.add("composer.input", Composer);
  ctx.add("blockkit.richTextInput", RichTextInput);
  ctx.add("realtime.handler", {
    run: invalidateSlashCommandSuggestions,
    types: ["commands_changed"],
  });
};

export default setup;
