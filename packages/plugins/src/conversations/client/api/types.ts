import type { PaneContentOf } from "../../../shell/client/api/types";

declare module "../../../shell/client/api/types" {
  interface PaneContents {
    channel: { id: string };
    dm: { id: string };
  }
}

export type View = PaneContentOf<"channel" | "dm">;

export type ChannelMessageTarget = { channelId: string; ts: string };
