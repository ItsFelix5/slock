import type { createGifsStore } from "./store";

declare module "@slock/core/types" {
  interface Services {
    gifs: ReturnType<typeof createGifsStore>;
  }
}
