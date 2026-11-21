import type { Setup } from "@slock/core";
import { lazyChunk } from "@slock/core/solid";

import { definePluginSettings } from "@slock/plugins/plugins/client/api";
import { createPendingFilesStore } from "./lib/pendingFiles";
import FileInput from "./views/FileInput";

const Composer = lazyChunk(() => import("./views/Composer"));
const RichTextInput = lazyChunk(() => import("./views/RichTextInput"));

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
