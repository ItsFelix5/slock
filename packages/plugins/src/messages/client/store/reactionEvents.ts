import type { ChannelId, Message, Ts, UserId } from "@slock/types";
import type { LocatedMessages } from "../lib/messageLocations";
import { addReactionUser, removeReactionUser } from "../lib/reactionList";
import type { LiveChange } from "./history/liveChanges";

export function createReactionEvents(deps: {
  findAllMessageLocations: (channelId: ChannelId, ts: Ts) => LocatedMessages[];
  patchMessage: (channelId: ChannelId, ts: Ts, patch: Partial<Message>) => void;
  recordLiveChange: (change: LiveChange) => void;
}) {
  function applyReactionEvent(
    channel: ChannelId,
    ts: Ts,
    name: string,
    userId: UserId,
    added: boolean,
  ) {
    deps.recordLiveChange({ channelId: channel, reaction: { added, name, userId }, ts });
    const msg = deps.findAllMessageLocations(channel, ts)[0]?.list.find((m) => m.ts === ts);
    if (!msg) return;
    const reactions = msg.reactions ?? [];
    const next = added
      ? addReactionUser(reactions, name, userId)
      : removeReactionUser(reactions, name, userId);
    if (next !== reactions) deps.patchMessage(channel, ts, { reactions: next });
  }

  return { applyReactionEvent };
}
