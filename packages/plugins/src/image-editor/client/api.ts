import type { createImageEditorStore } from "./store";

declare module "@slock/core/types" {
  interface Services {
    "image-editor": ReturnType<typeof createImageEditorStore>;
  }
}
