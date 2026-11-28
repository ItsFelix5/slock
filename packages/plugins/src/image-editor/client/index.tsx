import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { createImageEditorStore } from "./store";
import ImageEditorOverlay from "./views/ImageEditorOverlay";

const EDITABLE = /^image\/(?!svg)/;

const setup: Setup = (ctx) => {
  const editor = createImageEditorStore();
  ctx.provide("image-editor", editor);
  ctx.add("composer.fileAction", {
    accepts: (file) => EDITABLE.test(file.type),
    icon: "image",
    label: "Edit image",
    run: (file) => service("image-editor").edit(file),
  });
  ctx.add("shell.overlay", ImageEditorOverlay);
};

export default setup;
