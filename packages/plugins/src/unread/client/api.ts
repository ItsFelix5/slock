import type { createUnreadStore } from "./store";

declare module "@slock/core/types" {
  interface Points {
    "unread.counts": (notifications: Record<string, number>) => void;
  }
  interface Services {
    unread: ReturnType<typeof createUnreadStore>;
  }
}
