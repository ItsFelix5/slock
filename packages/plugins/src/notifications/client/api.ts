import type { createDesktopNotificationsStore } from "./store";

declare module "@slock/core/types" {
  interface Services {
    notifications: ReturnType<typeof createDesktopNotificationsStore>;
  }
}
