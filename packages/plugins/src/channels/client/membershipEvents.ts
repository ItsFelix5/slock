import { mapChannel } from "@slock/slack";
import type { MembershipEvent, User } from "@slock/types";
import type { createChannelsStore } from "./store";

type MembershipTarget = Pick<
  ReturnType<typeof createChannelsStore>,
  "addJoinedChannel" | "invalidateChannelRoster" | "markChannelLeft" | "patchChannel"
>;

export const MEMBERSHIP_EVENTS = [
  "channel_joined",
  "group_joined",
  "channel_left",
  "group_left",
  "member_joined_channel",
  "member_left_channel",
  "channel_rename",
  "group_rename",
  "channel_archive",
  "channel_unarchive",
  "group_archive",
  "group_unarchive",
  "channel_deleted",
] as const;

export function createMembershipHandler(
  channels: MembershipTarget,
  currentUser: () => User | undefined,
) {
  return function handleMembershipEvent(payload: MembershipEvent): void {
    switch (payload.type) {
      case "channel_joined":
      case "group_joined":
        channels.addJoinedChannel(mapChannel(payload.channel));
        break;
      case "channel_left":
      case "group_left":
      case "channel_deleted":
        if (payload.channel) channels.markChannelLeft(payload.channel);
        break;
      case "member_joined_channel":
        if (payload.channel) channels.invalidateChannelRoster(payload.channel);
        break;
      case "member_left_channel":
        if (!payload.channel) break;
        if (payload.user === currentUser()?.id) channels.markChannelLeft(payload.channel);
        else channels.invalidateChannelRoster(payload.channel);
        break;
      case "channel_rename":
      case "group_rename":
        if (payload.channel.id)
          channels.patchChannel(payload.channel.id, { name: payload.channel.name });
        break;
      case "channel_archive":
      case "group_archive":
        if (payload.channel) channels.patchChannel(payload.channel, { archived: true });
        break;
      case "channel_unarchive":
      case "group_unarchive":
        if (payload.channel) channels.patchChannel(payload.channel, { archived: false });
        break;
    }
  };
}
