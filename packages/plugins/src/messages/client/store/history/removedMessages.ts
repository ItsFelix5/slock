import type { ChannelId, Message, Ts } from "@slock/types";

export function createRemovedMessages() {
  const byChannel = new Map<ChannelId, Set<Ts>>();
  return {
    clear: (channelId: ChannelId) => byChannel.delete(channelId),
    forget(channelId: ChannelId, ts: Ts) {
      byChannel.set(channelId, (byChannel.get(channelId) ?? new Set()).add(ts));
    },
    without(channelId: ChannelId, messages: Message[]) {
      const removed = byChannel.get(channelId);
      return removed ? messages.filter((m) => !removed.has(m.ts)) : messages;
    },
  };
}
