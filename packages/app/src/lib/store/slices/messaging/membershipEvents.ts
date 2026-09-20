import type { Channel, DirectMessage, User } from "../../../api";
import { mapChannel } from "../../../api";

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
  function channelId(payload: any): string | undefined {
    return typeof payload.channel === "string" ? payload.channel : payload.channel?.id;
  }

  function handleMembershipEvent(payload: any): void {
    switch (payload.type) {
      case "channel_joined":
      case "group_joined":
        if (payload.channel) deps.addJoinedChannel(mapChannel(payload.channel));
        break;
      case "channel_left":
      case "group_left":
      case "channel_deleted": {
        const id = channelId(payload);
        if (id) deps.markChannelLeft(id);
        break;
      }
      case "member_left_channel":
        if (payload.channel && payload.user === deps.currentUser()?.id)
          deps.markChannelLeft(payload.channel);
        break;
      case "im_created": {
        const dmChannel = payload.channel;
        const userId = dmChannel?.user ?? payload.user;
        if (dmChannel?.id && userId) {
          if (deps.dmById(dmChannel.id)) {
            if (deps.closedDmIds[dmChannel.id]) deps.setClosedDmIds(dmChannel.id, false);
          } else {
            deps.ensureDm(dmChannel.id, userId);
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
      case "mpim_joined": {
        const id = channelId(payload);
        if (id) deps.ensureMpdm(id);
        break;
      }
      case "channel_rename":
      case "group_rename":
        if (payload.channel?.id)
          deps.patchChannel(payload.channel.id, { name: payload.channel.name });
        break;
      case "channel_archive":
      case "group_archive": {
        const id = channelId(payload);
        if (id) deps.patchChannel(id, { archived: true });
        break;
      }
      case "channel_unarchive":
      case "group_unarchive": {
        const id = channelId(payload);
        if (id) deps.patchChannel(id, { archived: false });
        break;
      }
    }
  }

  return { handleMembershipEvent };
}
