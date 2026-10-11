import type { createUnreadStore } from "./store";

declare module "@slock/core/types" {
  interface Services {
    unread: ReturnType<typeof createUnreadStore>;
  }
}
