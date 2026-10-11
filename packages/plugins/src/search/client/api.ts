import type { createSearchStore } from "./store";

declare module "@slock/core/types" {
  interface Services {
    search: ReturnType<typeof createSearchStore>;
  }
}
