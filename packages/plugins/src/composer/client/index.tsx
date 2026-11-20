import type { Setup } from "@slock/core";
import { lazy } from "solid-js";
import { definePluginSettings } from "../../plugins/client/api";
import { createPendingFilesStore } from "./lib/pendingFiles";
import FileInput from "./views/FileInput";

const Composer = lazy(() => import("./views/Composer"));
const RichTextInput = lazy(() => import("./views/RichTextInput"));

const setup: Setup = (ctx) => {
  void Composer.preload();
  const setting = definePluginSettings(ctx, {
    uploadOnAttach: { default: false, label: "Start uploading when a file is attached" },
  });
  ctx.provide("composer", {
    pendingFiles: createPendingFilesStore(),
    uploadOnAttach: setting("uploadOnAttach"),
  });
  ctx.add("composer.input", Composer);
  ctx.add("blockkit.fileInput", FileInput);
  ctx.add("blockkit.richTextInput", RichTextInput);
};

export default setup;
