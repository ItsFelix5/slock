import type { Message } from "@slock/types";
import type { MessageLocation } from "../lib/messageLocations";
import { addReactionUser, removeReactionUser } from "../lib/reactionList";

export function createReactionEvents(deps: {
  findAllMessageLocations: (
    channelId: string,
    ts: string,
  ) => { location: MessageLocation; list: Message[] }[];
  patchMessage: (channelId: string, ts: string, patch: Partial<Message>) => void;
}) {
  function applyReactionEvent(
    channel: string,
    ts: string,
    name: string,
    userId: string,
    added: boolean,
  ) {
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
