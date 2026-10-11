import type { createLaterSlice } from "./store";

declare module "@slock/core/types" {
  interface Services {
    later: ReturnType<typeof createLaterSlice>;
  }
}
