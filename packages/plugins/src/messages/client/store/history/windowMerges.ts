import type { ChannelId, Message, Ts } from "@slock/types";
import type { HistoryMeta } from "./historyFlags";
import { mergeNewerWindow, mergeOlderWindow } from "./historyWindow";

export function createWindowMerges(deps: {
  historyCursor: Map<ChannelId, string | undefined>;
  newerHistoryBoundary: Map<ChannelId, Ts>;
  patchMeta: (channelId: ChannelId, patch: Partial<HistoryMeta>) => void;
  replaceMessages: (channelId: ChannelId, compute: (existing: Message[]) => Message[]) => Message[];
}) {
  const { historyCursor, newerHistoryBoundary, patchMeta, replaceMessages } = deps;

  function mergeOlder(channelId: ChannelId, older: Message[]) {
    let cut = false;
    const kept = replaceMessages(channelId, (existing) => {
      const { cut: trimmed, list } = mergeOlderWindow(existing, older);
      cut = trimmed;
      return list;
    });
    const newest = kept.at(-1);
    if (!(cut && newest)) return;
    newerHistoryBoundary.set(channelId, newest.ts);
    patchMeta(channelId, { anchored: true, hasNewer: true });
  }

  function mergeNewer(channelId: ChannelId, newer: Message[]) {
    let cut = false;
    const kept = replaceMessages(channelId, (existing) => {
      const { cut: trimmed, list } = mergeNewerWindow(existing, newer);
      cut = trimmed;
      return list;
    });
    const [oldest] = kept;
    if (!(cut && oldest)) return;
    historyCursor.set(channelId, `before:${oldest.ts}`);
    patchMeta(channelId, { hasMore: true });
  }

  return { mergeNewer, mergeOlder };
}
