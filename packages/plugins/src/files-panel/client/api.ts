import type { createFilesLinksPanel } from "./store";

export type { FilesLinksEntry } from "./store";

declare module "@slock/core/types" {
  interface Services {
    "files-panel": ReturnType<typeof createFilesLinksPanel>;
  }
}
