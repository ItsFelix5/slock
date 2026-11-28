import type { ChannelId } from "@slock/types";
import type { Component } from "solid-js";
import type { createChannelDetailsStore } from "./channelDetails";

type ChannelDetailsTabProps = {
  channelId: ChannelId;
  channelName: string;
  memberCount?: number;
  archived: boolean;
  private: boolean;
  groupChat: boolean;
  refetch(): void;
};

export type ChannelDetailsTabItem = {
  id: string;
  label: string;
  view: Component<ChannelDetailsTabProps>;
  audience?: "channelManagers" | "groupChat";
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
