import type { createAppHomeStore } from "./store";

declare module "@slock/core/types" {
  interface Services {
    "app-home": ReturnType<typeof createAppHomeStore>;
  }
}
