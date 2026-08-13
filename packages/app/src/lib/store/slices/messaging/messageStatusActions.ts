import type { Message } from "@slock/slack-api";
import { toggleThreadSubscription } from "@slock/slack-api";
import { createStore, produce } from "solid-js/store";
import { actionFeedback } from "../feedback";

export function createMessageStatusActions(deps: {
  clearChannelUnread: (channelId: string) => void;
  setLastReadByChannel: (channelId: string, ts: number) => void;
  setUnreadDividerTs: (channelId: string, ts: number) => void;
  setUnreadChannelIds: (channelId: string, unread: boolean) => void;
  setChannelRead: (channelId: string, ts: string) => Promise<boolean>;
  syncChannelRead: (channelId: string, ts: string) => Promise<boolean>;
  messagesByChannel: Record<string, Message[]>;
  threadMessages: Record<string, Message[]>;
  patchMessage: (channelId: string, ts: string, patch: Partial<Message>) => void;
}) {
  const { messagesByChannel, threadMessages, patchMessage } = deps;
  const [threadSubscriptionPending, setThreadSubscriptionPending] = createStore<
    Record<string, boolean>
  >({});
  const subscriptionPendingKey = (channelId: string, ts: string) => `${channelId}:${ts}`;
  function isThreadSubscriptionPending(channelId: string, ts: string): boolean {
    return !!threadSubscriptionPending[subscriptionPendingKey(channelId, ts)];
  }
  function isThreadSubscribed(ts: string): boolean {
    return !!threadMessages[ts]?.[0]?.isSubscribed;
  }
  async function toggleThreadSubscribed(channelId: string, ts: string) {
    const pendingKey = subscriptionPendingKey(channelId, ts);
    if (threadSubscriptionPending[pendingKey]) return;
    setThreadSubscriptionPending(pendingKey, true);
    const currentlySubscribed = isThreadSubscribed(ts);
    patchMessage(channelId, ts, { isSubscribed: !currentlySubscribed });
    try {
      await toggleThreadSubscription(channelId, ts, currentlySubscribed);
    } catch (err) {
      console.error("Failed to toggle thread subscription", err);
      actionFeedback.flash(ts, "Failed to update thread subscription.", "error");
      patchMessage(channelId, ts, { isSubscribed: currentlySubscribed });
    } finally {
      setThreadSubscriptionPending(
        produce((pending) => {
          delete pending[pendingKey];
        }),
      );
    }
  }

  async function unsubscribeFromThread(channelId: string, ts: string) {
    const pendingKey = subscriptionPendingKey(channelId, ts);
    if (threadSubscriptionPending[pendingKey]) return;
    setThreadSubscriptionPending(pendingKey, true);
    patchMessage(channelId, ts, { isSubscribed: false });
    try {
      await toggleThreadSubscription(channelId, ts, true);
    } catch (err) {
      console.error("Failed to unsubscribe from thread", err);
      actionFeedback.flash(ts, "Failed to unsubscribe from thread.", "error");
      patchMessage(channelId, ts, { isSubscribed: true });
    } finally {
      setThreadSubscriptionPending(
        produce((pending) => {
          delete pending[pendingKey];
        }),
      );
    }
  }
  async function markCurrentChannelRead(channelId: string): Promise<boolean> {
    const list = messagesByChannel[channelId];
    const latest = list?.[list.length - 1]?.ts ?? (Date.now() / 1000).toFixed(6);
    if (!(await deps.syncChannelRead(channelId, latest))) return false;
    deps.clearChannelUnread(channelId);
    deps.setLastReadByChannel(channelId, parseFloat(latest) * 1000);
    return true;
  }
  async function markMessageUnread(channelId: string, ts: string): Promise<boolean> {
    const list = messagesByChannel[channelId] ?? [];
    const idx = list.findIndex((m) => m.ts === ts);
    const previousTs =
      idx > 0 ? list[idx - 1].ts : idx === 0 ? "0" : (parseFloat(ts) - 0.000001).toFixed(6);
    const previousMs = parseFloat(previousTs) * 1000;
    if (!(await deps.setChannelRead(channelId, previousTs))) {
      actionFeedback.flash(ts, "Failed to mark as unread.", "error");
      return false;
    }
    deps.setLastReadByChannel(channelId, previousMs);
    deps.setUnreadDividerTs(channelId, previousMs);
    deps.setUnreadChannelIds(channelId, true);
    return true;
  }
  return {
    isThreadSubscribed,
    isThreadSubscriptionPending,
    markCurrentChannelRead,
    markMessageUnread,
    toggleThreadSubscribed,
    unsubscribeFromThread,
  };
}
