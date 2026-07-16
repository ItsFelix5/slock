import type { Message, User } from "@slock/slack-api";

export function createMessageMergeActions(deps: {
  currentUser: () => User | undefined;
  setMessagesByChannel: (channelId: string, update: (existing: Message[]) => Message[]) => void;
}) {
  function insertMessageInOrder(channelId: string, msg: Message) {
    deps.setMessagesByChannel(channelId, (existing = []) => {
      if (existing.some((m) => m.ts === msg.ts)) return existing;
      const idx = existing.findIndex((m) => parseFloat(m.ts) > parseFloat(msg.ts));
      if (idx === -1) return [...existing, msg];
      return [...existing.slice(0, idx), msg, ...existing.slice(idx)];
    });
  }
  function mergeIncomingMessage(existing: Message[], msg: Message): Message[] {
    if (existing.some((m) => m.ts === msg.ts || m.id === msg.ts)) return existing;
    const me = deps.currentUser();
    if (me && msg.userId === me.id) {
      const pendingIdx = existing.findIndex(
        (m) => m.id.startsWith("pending-") && m.text === msg.text,
      );
      if (pendingIdx !== -1) {
        const next = existing.slice();
        next[pendingIdx] = msg;
        return next;
      }
    }
    return [...existing, msg];
  }
  return { insertMessageInOrder, mergeIncomingMessage };
}
