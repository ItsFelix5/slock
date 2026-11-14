import type { Message } from "@slock/types";

export function createRemovedMessages() {
  const byChannel = new Map<string, Set<string>>();
  return {
    clear: (channelId: string) => byChannel.delete(channelId),
    forget(channelId: string, ts: string) {
      byChannel.set(channelId, (byChannel.get(channelId) ?? new Set()).add(ts));
    },
    without(channelId: string, messages: Message[]) {
      const removed = byChannel.get(channelId);
      return removed ? messages.filter((m) => !removed.has(m.ts)) : messages;
    },
  };
}
