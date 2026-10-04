import type { MembershipEvent } from "@slock/types";
import { type Channel, type DirectMessage, mapChannel, type User } from "@slock/types";

export function createMembershipEvents(deps: {
  currentUser: () => User | undefined;
  addJoinedChannel: (channel: Channel) => void;
  markChannelLeft: (channelId: string) => void;
  allDirectMessages: () => DirectMessage[];
  dmById: (id: string) => DirectMessage | undefined;
  closedDmIds: Record<string, boolean>;
  setClosedDmIds: (id: string, closed: boolean) => void;
  ensureDm: (channelId: string, userId: string) => void;
  ensureMpdm: (channelId: string) => void;
  patchChannel: (id: string, patch: Partial<Channel>) => void;
}) {
  function handleMembershipEvent(payload: MembershipEvent): void {
    switch (payload.type) {
      case "channel_joined":
      case "group_joined":
        deps.addJoinedChannel(mapChannel(payload.channel));
        break;
      case "channel_left":
      case "group_left":
      case "channel_deleted":
        if (payload.channel) deps.markChannelLeft(payload.channel);
        break;
      case "member_left_channel":
        if (payload.channel && payload.user === deps.currentUser()?.id)
          deps.markChannelLeft(payload.channel);
        break;
      case "im_created": {
        const { channel } = payload;
        const userId = channel.user ?? payload.user;
        if (userId) {
          if (deps.dmById(channel.id)) {
            if (deps.closedDmIds[channel.id]) deps.setClosedDmIds(channel.id, false);
          } else {
            deps.ensureDm(channel.id, userId);
          }
        }
        break;
      }
      case "im_close":
      case "mpim_close":
        if (payload.channel) deps.setClosedDmIds(payload.channel, true);
        break;
      case "im_open":
      case "mpim_open":
        if (payload.channel) deps.setClosedDmIds(payload.channel, false);
        break;
      case "mpim_joined":
        if (payload.channel) deps.ensureMpdm(payload.channel);
        break;
      case "channel_rename":
      case "group_rename":
        if (payload.channel.id)
          deps.patchChannel(payload.channel.id, { name: payload.channel.name });
        break;
      case "channel_archive":
      case "group_archive":
        if (payload.channel) deps.patchChannel(payload.channel, { archived: true });
        break;
      case "channel_unarchive":
      case "group_unarchive":
        if (payload.channel) deps.patchChannel(payload.channel, { archived: false });
        break;
    }
  }

  return { handleMembershipEvent };
}
