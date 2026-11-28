import type { PaneContentOf } from "@slock/plugins/shell/client/api/types";
import type { ChannelId, Ts } from "@slock/types";

declare module "../../../shell/client/api/types" {
  interface PaneContents {
    channel: { id: ChannelId };
    dm: { id: ChannelId };
  }
}

export type View = PaneContentOf<"channel" | "dm">;

export type ChannelMessageTarget = { channelId: ChannelId; ts: Ts };

export type PaneSide = "before" | "over" | "after";
