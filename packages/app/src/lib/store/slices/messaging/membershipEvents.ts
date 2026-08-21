import type { Channel, DirectMessage, User } from "../../../api";
import { mapChannel } from "../../../api";

export function createMembershipEvents(deps: {
  currentUser: () => User | undefined;
  addJoinedChannel: (channel: Channel) => void;
  markChannelLeft: (channelId: string) => void;
  allDirectMessages: () => DirectMessage[];
  closedDmIds: Record<string, boolean>;
  setClosedDmIds: (id: string, closed: boolean) => void;
  ensureDm: (channelId: string, userId: string) => void;
}) {
  function handleMembershipEvent(payload: any): void {
    switch (payload.type) {
      case "channel_joined":
      case "group_joined":
        if (payload.channel) deps.addJoinedChannel(mapChannel(payload.channel));
        break;
      case "channel_left":
      case "group_left": {
        const channelId =
          typeof payload.channel === "string" ? payload.channel : payload.channel?.id;
        if (channelId) deps.markChannelLeft(channelId);
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
          if (deps.allDirectMessages().some((d) => d.id === dmChannel.id)) {
            if (deps.closedDmIds[dmChannel.id]) deps.setClosedDmIds(dmChannel.id, false);
          } else {
            deps.ensureDm(dmChannel.id, userId);
          }
        }
        break;
      }
    }
  }

  return { handleMembershipEvent };
}
