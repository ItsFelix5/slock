import type { Channel } from "@slock/types";
import type { IconName } from "@slock/ui";
import type { createChannelsStore } from "../store";

export type ChannelDecorator = (channel: Channel) => Channel;

declare module "@slock/core/types" {
  interface Points {
    "channels.decorate": ChannelDecorator;
  }
  interface Services {
    channels: ReturnType<typeof createChannelsStore>;
  }
}

export function channelDisplayName(
  channel: Pick<Channel, "id" | "name"> | undefined,
  fallbackId?: string,
): string {
  return channel?.name?.trim() || channel?.id || fallbackId || "";
}

export function channelIconName(isPrivate: boolean | undefined, isArchived?: boolean): IconName {
  if (isArchived) return "archive";
  return isPrivate ? "lock" : "channel";
}
