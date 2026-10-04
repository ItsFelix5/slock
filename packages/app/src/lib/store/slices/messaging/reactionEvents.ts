import type { Message } from "@slock/types";
import type { MessageLocation } from "../types";

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
    const locations = deps.findAllMessageLocations(channel, ts);
    const msg = locations[0]?.list.find((m) => m.ts === ts);
    if (msg) {
      const reactions = msg.reactions ?? [];
      const existing = reactions.find((r) => r.name === name);
      let next: typeof reactions;
      if (added) {
        next = existing
          ? reactions.map((r) =>
              r.name === name ? { ...r, count: r.count + 1, users: [...r.users, userId] } : r,
            )
          : [...reactions, { count: 1, name, users: [userId] }];
      } else if (existing) {
        next = reactions
          .map((r) =>
            r.name === name
              ? {
                  ...r,
                  count: r.count - 1,
                  users: r.users.filter((u) => u !== userId),
                }
              : r,
          )
          .filter((r) => r.count > 0);
      } else {
        next = reactions;
      }
      deps.patchMessage(channel, ts, { reactions: next });
    }
  }

  return { applyReactionEvent };
}
