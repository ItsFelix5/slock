import { assertNever } from "@slock/core";
import { ifPresent, mapChannel, parseChannelId } from "@slock/slack";
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
      case "channel_deleted": {
        const id = ifPresent(parseChannelId, payload.channel);
        if (id) channels.markChannelLeft(id);
        break;
      }
      case "member_joined_channel": {
        const id = ifPresent(parseChannelId, payload.channel);
        if (id) channels.invalidateChannelRoster(id);
        break;
      }
      case "member_left_channel": {
        const id = ifPresent(parseChannelId, payload.channel);
        if (!id) break;
        if (payload.user === currentUser()?.id) channels.markChannelLeft(id);
        else channels.invalidateChannelRoster(id);
        break;
      }
      case "channel_rename":
      case "group_rename": {
        const id = ifPresent(parseChannelId, payload.channel.id);
        if (id) channels.patchChannel(id, { name: payload.channel.name });
        break;
      }
      case "channel_archive":
      case "group_archive":
      case "channel_unarchive":
      case "group_unarchive": {
        const id = ifPresent(parseChannelId, payload.channel);
        const archived = payload.type === "channel_archive" || payload.type === "group_archive";
        if (id) channels.patchChannel(id, { archived });
        break;
      }
      case "im_close":
      case "im_created":
      case "im_open":
      case "mpim_close":
      case "mpim_joined":
      case "mpim_open":
        break;
      default:
        assertNever(payload);
    }
  };
}
