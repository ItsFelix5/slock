import type { ChannelId, Ts } from "@slock/types";
import type { createMessageNavigation } from "../navigation";

declare module "@slock/core/types" {
  interface Points {
    "message-links.loaded": (channelId: ChannelId, ts: Ts) => boolean;
  }
  interface Services {
    "message-links": ReturnType<typeof createMessageNavigation>;
  }
}
