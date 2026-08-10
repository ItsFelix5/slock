import type { Message, User } from "@slock/slack-api";
import { dedupeMessages } from "./messageMerge";

export function createMessageMergeActions(deps: {
  currentUser: () => User | undefined;
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
    const me = deps.currentUser();
    if (me && msg.userId === me.id) {
      const pendingIdx = existing.findIndex(
        (m) => m.id.startsWith("pending-") && m.text === msg.text,
      );
      if (pendingIdx !== -1) {
        const next = existing.slice();
        next[pendingIdx] = msg;
        return dedupeMessages(next);
      }
    }
    if (existing.some((m) => m.ts === msg.ts || m.id === msg.id)) return dedupeMessages(existing);
    return dedupeMessages([...existing, msg]);
  }
  return { insertMessageInOrder, mergeIncomingMessage };
}
