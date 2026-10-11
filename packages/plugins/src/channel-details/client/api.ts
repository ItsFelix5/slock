import type { Component } from "solid-js";
import type { createChannelDetailsStore } from "./channelDetails";

export type { MemberFilter } from "./channelDetails";

export type ChannelDetailsTabProps = {
  channelId: string;
  channelName: string;
  memberCount?: number;
  archived: boolean;
  private: boolean;
  refetch(): void;
};

export type ChannelDetailsTabItem = {
  id: string;
  label: string;
  view: Component<ChannelDetailsTabProps>;
  managerOnly?: boolean;
  count?: (details: { memberCount?: number }) => number | undefined;
};

declare module "@slock/core/types" {
  interface Services {
    "channel-details": ReturnType<typeof createChannelDetailsStore>;
  }
  interface Points {
    "channel-details.tab": ChannelDetailsTabItem;
  }
}
