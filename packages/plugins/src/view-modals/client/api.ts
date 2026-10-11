import type { createModalsSlice } from "./store";

declare module "@slock/core/types" {
  interface Services {
    "view-modals": ReturnType<typeof createModalsSlice>;
  }
}
