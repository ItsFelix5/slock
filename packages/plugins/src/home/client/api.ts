import type { Accessor, Component } from "solid-js";

export type HomeSectionProps = { unreadsOnly: Accessor<boolean> };

export type HomeChannelRows = {
  active: (channelId: string) => boolean;
  view: Component<{ channelId: string }>;
};

declare module "@slock/core/types" {
  interface Points {
    "home.section": Component<HomeSectionProps>;
    "home.channelRows": HomeChannelRows;
  }
}
