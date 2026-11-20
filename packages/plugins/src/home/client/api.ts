import type { ChannelId } from "@slock/types";
import type { Accessor, Component } from "solid-js";

export type HomeSectionProps = { unreadsOnly: Accessor<boolean> };

export type HomeChannelRows = {
  active: (channelId: ChannelId) => boolean;
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
