import type { Message } from "@slock/types";
import { confirmsPending, dedupeMessages, isPendingMessage } from "../../../../messageMerge";

export function createMessageMergeActions(deps: {
  setMessagesByChannel: (channelId: string, update: (existing: Message[]) => Message[]) => void;
}) {
  function insertMessageInOrder(channelId: string, msg: Message) {
    deps.setMessagesByChannel(channelId, (existing = []) => {
      const messages = dedupeMessages(existing);
      if (messages.some((m) => m.ts === msg.ts)) return messages;
      const idx = messages.findIndex((m) => parseFloat(m.ts) > parseFloat(msg.ts));
      if (idx === -1) return [...messages, msg];
      return [...messages.slice(0, idx), msg, ...messages.slice(idx)];
    });
  }
  function mergeIncomingMessage(existing: Message[], msg: Message): Message[] {
    const matchingIndex = existing.findIndex((m) => m.ts === msg.ts || m.id === msg.id);
    if (matchingIndex !== -1) {
      if (isPendingMessage(existing[matchingIndex]) && !isPendingMessage(msg)) {
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
    if (!last || parseFloat(last.ts) < parseFloat(msg.ts)) return [...existing, msg];
    return dedupeMessages([...existing, msg]);
  }
  return { insertMessageInOrder, mergeIncomingMessage };
}
