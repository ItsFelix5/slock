import type { createTypingSlice } from "./store";

declare module "@slock/core/types" {
  interface Services {
    typing: ReturnType<typeof createTypingSlice>;
  }
}
