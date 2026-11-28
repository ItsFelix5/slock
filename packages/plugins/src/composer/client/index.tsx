import type { Setup } from "@slock/core";
import { lazyChunk } from "@slock/core/solid";

import { draftCacheKey } from "@slock/plugins/drafts/client/api";
import { definePluginSettings } from "@slock/plugins/plugins/client/api";
import { startUpload } from "./lib/attachUpload";
import { createPendingFilesStore } from "./lib/pendingFiles";
import FileInput from "./views/FileInput";
import { DELETE_DRAFT_SHORTCUT } from "./views/popovers/DraftsMenu";

const Composer = lazyChunk(() => import("./views/TargetComposer"));
const RichTextInput = lazyChunk(() => import("./views/RichTextInput"));

const setup: Setup = (ctx) => {
  void Composer.preload();
  const setting = definePluginSettings(ctx, {
    uploadOnAttach: { default: false, label: "Start uploading when a file is attached" },
  });
  const pendingFiles = createPendingFilesStore();
  const uploadOnAttach = setting("uploadOnAttach");
  ctx.provide("composer", {
    attachFiles(target, files) {
      const key = draftCacheKey(target.channelId, target.threadTs);
      if (uploadOnAttach()) for (const file of files) startUpload(file);
      pendingFiles.set(key, [...pendingFiles.get(key), ...files]);
    },
    pendingFiles,
    uploadOnAttach,
  });
  ctx.onCleanup(ctx.get("ui").shortcuts.declare([DELETE_DRAFT_SHORTCUT]));
  ctx.add("composer.input", Composer);
  ctx.add("blockkit.fileInput", FileInput);
  ctx.add("blockkit.richTextInput", RichTextInput);
};

export default setup;
