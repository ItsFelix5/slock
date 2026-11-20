import type { ChannelId, Ts } from "@slock/types";
import type { createMessageNavigation } from "../navigation";
import type { createIncomingShare } from "./incomingLinks";

declare module "@slock/core/types" {
  interface Points {
    "message-links.loaded": (channelId: ChannelId, ts: Ts) => boolean;
  }
  interface Services {
    "message-links": ReturnType<typeof createMessageNavigation>;
    "message-links.share": ReturnType<typeof createIncomingShare>;
  }
}
