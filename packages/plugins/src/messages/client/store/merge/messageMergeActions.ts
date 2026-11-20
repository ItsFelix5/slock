import { defined } from "@slock/core";
import { compareTs } from "@slock/slack";
import type { ChannelId, Message } from "@slock/types";
import { confirmsPending, dedupeMessages, isPendingMessage } from "../../api/messageMerge";

export function createMessageMergeActions(deps: {
  updateChannelMessages: (channelId: ChannelId, update: (existing: Message[]) => Message[]) => void;
}) {
  function insertMessageInOrder(channelId: ChannelId, msg: Message) {
    deps.updateChannelMessages(channelId, (existing) => {
      const messages = dedupeMessages(existing);
      if (messages.some((m) => m.ts === msg.ts)) return messages;
      const idx = messages.findIndex((m) => compareTs(m.ts, msg.ts) > 0);
      if (idx === -1) return [...messages, msg];
      return [...messages.slice(0, idx), msg, ...messages.slice(idx)];
    });
  }
  function mergeIncomingMessage(existing: Message[], msg: Message): Message[] {
    const matchingIndex = existing.findIndex((m) => m.ts === msg.ts || m.id === msg.id);
    if (matchingIndex !== -1) {
      if (isPendingMessage(defined(existing[matchingIndex])) && !isPendingMessage(msg)) {
        const next = existing.slice();
        next[matchingIndex] = msg;
        return dedupeMessages(next);
      }
      return existing;
    }
    const pendingIdx = existing.findIndex((m) => confirmsPending(m, msg));
    if (pendingIdx !== -1) {
      const next = existing.slice();
      next[pendingIdx] = msg;
      return dedupeMessages(next);
    }
    const last = existing.at(-1);
    if (!last || compareTs(last.ts, msg.ts) < 0) return [...existing, msg];
    return dedupeMessages([...existing, msg]);
  }
  return { insertMessageInOrder, mergeIncomingMessage };
}
