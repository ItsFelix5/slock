import type { createPrefsStore } from "./store";

declare module "@slock/core/types" {
  interface Services {
    prefs: ReturnType<typeof createPrefsStore>;
  }
}
