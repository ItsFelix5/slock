import type { createTemplatesStore } from "./store";

declare module "@slock/core/types" {
  interface Services {
    templates: ReturnType<typeof createTemplatesStore>;
  }
}
