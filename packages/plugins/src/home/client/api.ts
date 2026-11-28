import type { CycleTarget } from "@slock/plugins/sidebar/client/api";
import type { ChannelId } from "@slock/types";
import type { Accessor, Component } from "solid-js";

export type HomeSectionProps = { unreadsOnly: Accessor<boolean> };

type HomeChannelRows = {
  active: (channelId: ChannelId) => boolean;
  cycleTargets: (channelId: ChannelId) => CycleTarget[];
  view: Component<{ channelId: ChannelId }>;
};

export type HomeRowEndProps = { id: ChannelId; kind: "channel" | "dm" };

declare module "@slock/core/types" {
  interface Points {
    "home.rowEnd": Component<HomeRowEndProps>;
    "home.section": Component<HomeSectionProps>;
    "home.channelRows": HomeChannelRows;
  }
}
