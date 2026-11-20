import type { ChannelId } from "@slock/types";
import type { PaneContentOf } from "../../shell/client/api/types";
import type { createPinnedSlice } from "./store";

export type PinnedPaneContent = PaneContentOf<"pinned">;

declare module "../../shell/client/api/types" {
  interface PaneContents {
    pinned: { channelId: ChannelId };
  }
}

declare module "@slock/core/types" {
  interface Services {
    pins: ReturnType<typeof createPinnedSlice>;
  }
}
