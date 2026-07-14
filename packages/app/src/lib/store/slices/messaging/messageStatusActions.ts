import type { Message } from "@slock/slack-api";
import { markChannelRead, toggleThreadSubscription } from "@slock/slack-api";
import { actionFeedback } from "../feedback";

export function createMessageStatusActions(deps: {
  clearChannelUnread: (channelId: string) => void;
  setLastReadByChannel: (channelId: string, ts: number) => void;
  setUnreadDividerTs: (channelId: string, ts: number) => void;
  setUnreadChannelIds: (channelId: string, unread: boolean) => void;
  messagesByChannel: Record<string, Message[]>;
  threadMessages: Record<string, Message[]>;
  patchMessage: (channelId: string, ts: string, patch: Partial<Message>) => void;
}) {
  const { messagesByChannel, threadMessages, patchMessage } = deps;
  function isThreadSubscribed(ts: string): boolean {
    return !!threadMessages[ts]?.[0]?.isSubscribed;
  }
  async function toggleThreadSubscribed(channelId: string, ts: string) {
    const currentlySubscribed = isThreadSubscribed(ts);
    patchMessage(channelId, ts, { isSubscribed: !currentlySubscribed });
    try {
      await toggleThreadSubscription(channelId, ts, currentlySubscribed);
    } catch (err) {
      console.error("Failed to toggle thread subscription", err);
      actionFeedback.flash(ts, "Failed to update thread subscription.", "error");
      patchMessage(channelId, ts, { isSubscribed: currentlySubscribed });
    }
  }
  function markCurrentChannelRead(channelId: string) {
    deps.clearChannelUnread(channelId);
    const list = messagesByChannel[channelId];
    const latest = list?.[list.length - 1]?.ts ?? (Date.now() / 1000).toFixed(6);
    deps.setLastReadByChannel(channelId, parseFloat(latest) * 1000);
    markChannelRead(channelId, latest).catch(() => {});
  }
  function markMessageUnread(channelId: string, ts: string) {
    const list = messagesByChannel[channelId] ?? [];
    const idx = list.findIndex((m) => m.ts === ts);
    const previousTs =
      idx > 0 ? list[idx - 1].ts : idx === 0 ? "0" : (parseFloat(ts) - 0.000001).toFixed(6);
    const previousMs = parseFloat(previousTs) * 1000;
    deps.setLastReadByChannel(channelId, previousMs);
    deps.setUnreadDividerTs(channelId, previousMs);
    markChannelRead(channelId, previousTs)
      .then(() => {
        deps.setUnreadChannelIds(channelId, true);
      })
      .catch(() => actionFeedback.flash(ts, "Failed to mark as unread.", "error"));
  }
  return { isThreadSubscribed, markCurrentChannelRead, markMessageUnread, toggleThreadSubscribed };
}
