import type { createMessageNavigation } from "../navigation";

declare module "@slock/core/types" {
  interface Services {
    "message-links": ReturnType<typeof createMessageNavigation>;
  }
}
