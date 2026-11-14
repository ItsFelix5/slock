import type { createMessageNavigation } from "../navigation";

declare module "@slock/core/types" {
  interface Points {
    "message-links.loaded": (channelId: string, ts: string) => boolean;
  }
  interface Services {
    "message-links": ReturnType<typeof createMessageNavigation>;
  }
}
