import type { ChannelId, Ts } from "@slock/types";
import type { PaneContentOf } from "../../../shell/client/api/types";

declare module "../../../shell/client/api/types" {
  interface PaneContents {
    channel: { id: ChannelId };
    dm: { id: ChannelId };
  }
}

export type View = PaneContentOf<"channel" | "dm">;

export type ChannelMessageTarget = { channelId: ChannelId; ts: Ts };
