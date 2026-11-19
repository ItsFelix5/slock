import { defined } from "@slock/core";
import { service } from "@slock/core/solid";
import { parseTs } from "@slock/slack";
import type { ChannelId, Message, Ts } from "@slock/types";
import { createStore } from "solid-js";
import { toggleThreadSubscription } from "../../../slack/client/api";
import { tsFromMs, tsJustBefore, tsToMs } from "../lib/tsTime";

const feedback = service("feedback");

export function createMessageStatusActions(deps: {
  clearChannelUnread: (channelId: ChannelId) => void;
  lastReadFor: (channelId: ChannelId) => number | undefined;
  unreadDividerTsFor: (channelId: ChannelId) => number | undefined;
  setLastReadByChannel: (channelId: ChannelId, ts: number) => void;
  setUnreadDividerTs: (channelId: ChannelId, ts: number) => void;
  setUnreadChannelIds: (channelId: ChannelId, unread: boolean) => void;
  setChannelRead: (channelId: ChannelId, ts: Ts) => Promise<boolean>;
  syncChannelRead: (channelId: ChannelId, ts: Ts) => Promise<boolean>;
  setThreadRead: (channelId: ChannelId, threadTs: Ts, ts: Ts) => Promise<boolean>;
  threadReadTsFor: (threadTs: Ts) => Ts | undefined;
  hasMoreHistory: (channelId: ChannelId) => boolean;
  hasNewerHistory: (channelId: ChannelId) => boolean;
  messagesByChannel: Record<ChannelId, Message[]>;
  threadMessages: Record<Ts, Message[]>;
  patchMessage: (channelId: ChannelId, ts: Ts, patch: Partial<Message>) => void;
}) {
  const { messagesByChannel, threadMessages, patchMessage } = deps;
  const [threadSubscriptionPending, setThreadSubscriptionPending] = createStore<
    Record<string, boolean>
  >({});
  const [threadUnsubscribed, setThreadUnsubscribed] = createStore<Record<string, boolean>>({});
  const subscriptionPendingKey = (channelId: ChannelId, ts: Ts) => `${channelId}:${ts}`;
  function isThreadSubscriptionPending(channelId: ChannelId, ts: Ts): boolean {
    return !!threadSubscriptionPending[subscriptionPendingKey(channelId, ts)];
  }
  function isThreadUnsubscribed(channelId: ChannelId, ts: Ts): boolean {
    return !!threadUnsubscribed[subscriptionPendingKey(channelId, ts)];
  }
  function isThreadSubscribed(ts: Ts): boolean {
    return !!threadMessages[ts]?.[0]?.isSubscribed;
  }
  async function toggleThreadSubscribed(channelId: ChannelId, ts: Ts) {
    const pendingKey = subscriptionPendingKey(channelId, ts);
    if (threadSubscriptionPending[pendingKey]) return;
    setThreadSubscriptionPending((s) => {
      s[pendingKey] = true;
    });
    const currentlySubscribed = isThreadSubscribed(ts);
    patchMessage(channelId, ts, { isSubscribed: !currentlySubscribed });
    try {
      await toggleThreadSubscription(channelId, ts, currentlySubscribed);
    } catch (err) {
      console.error("Failed to toggle thread subscription", err);
      feedback.flash(ts, "Failed to update thread subscription.", "error");
      patchMessage(channelId, ts, { isSubscribed: currentlySubscribed });
    } finally {
      setThreadSubscriptionPending((pending) => {
        delete pending[pendingKey];
      });
    }
  }

  async function unsubscribeFromThread(channelId: ChannelId, ts: Ts) {
    const pendingKey = subscriptionPendingKey(channelId, ts);
    if (threadSubscriptionPending[pendingKey]) return;
    setThreadSubscriptionPending((s) => {
      s[pendingKey] = true;
    });
    patchMessage(channelId, ts, { isSubscribed: false });
    setThreadUnsubscribed((s) => {
      s[pendingKey] = true;
    });
    try {
      await toggleThreadSubscription(channelId, ts, true);
    } catch (err) {
      console.error("Failed to unsubscribe from thread", err);
      feedback.flash(ts, "Failed to unsubscribe from thread.", "error");
      patchMessage(channelId, ts, { isSubscribed: true });
      setThreadUnsubscribed((s) => {
        s[pendingKey] = false;
      });
    } finally {
      setThreadSubscriptionPending((pending) => {
        delete pending[pendingKey];
      });
    }
  }
  async function markCurrentChannelRead(channelId: ChannelId): Promise<boolean> {
    const loadedLatest = deps.hasNewerHistory(channelId)
      ? undefined
      : messagesByChannel[channelId]?.at(-1)?.ts;
    const latest = loadedLatest ?? tsFromMs(Date.now());
    const latestMs = tsToMs(latest);
    if (latestMs <= (deps.lastReadFor(channelId) ?? 0)) {
      deps.clearChannelUnread(channelId);
      return true;
    }
    if (!(await deps.syncChannelRead(channelId, latest))) return false;
    deps.clearChannelUnread(channelId);
    deps.setLastReadByChannel(channelId, latestMs);
    return true;
  }
  function isMessageUnread(channelId: ChannelId, ts: Ts, threadTs?: Ts) {
    if (threadTs) {
      const root = threadMessages[threadTs]?.[0];
      const readTs = deps.threadReadTsFor(threadTs) ?? root?.threadLastRead ?? threadTs;
      return ts !== threadTs && Number(ts) > Number(readTs);
    }
    const anchor = deps.unreadDividerTsFor(channelId) ?? deps.lastReadFor(channelId) ?? 0;
    return tsToMs(ts) > anchor;
  }
  async function markMessageRead(channelId: ChannelId, ts: Ts): Promise<boolean> {
    const priorLastRead = deps.lastReadFor(channelId);
    const priorDivider = deps.unreadDividerTsFor(channelId);
    deps.setLastReadByChannel(channelId, tsToMs(ts));
    deps.setUnreadDividerTs(channelId, tsToMs(ts));
    if (!(await deps.setChannelRead(channelId, ts))) {
      deps.setLastReadByChannel(channelId, priorLastRead ?? 0);
      deps.setUnreadDividerTs(channelId, priorDivider ?? Infinity);
      feedback.flash(ts, "Failed to mark as read.", "error");
      return false;
    }
    const latest = messagesByChannel[channelId]?.at(-1)?.ts;
    if (!deps.hasNewerHistory(channelId) && (!latest || latest === ts))
      deps.clearChannelUnread(channelId);
    return true;
  }
  function toggleMessageUnread(channelId: ChannelId, ts: Ts, threadTs?: Ts) {
    if (isMessageUnread(channelId, ts, threadTs)) {
      if (threadTs) return deps.setThreadRead(channelId, threadTs, ts);
      return markMessageRead(channelId, ts);
    }
    return markMessageUnread(channelId, ts, threadTs);
  }
  async function markMessageUnread(
    channelId: ChannelId,
    ts: Ts,
    threadTs?: Ts,
  ): Promise<boolean> {
    if (threadTs) {
      const list = threadMessages[threadTs] ?? [];
      const idx = list.findIndex((m) => m.ts === ts);
      const previousTs = idx > 0 ? defined(list[idx - 1]).ts : tsJustBefore(ts);
      if (!(await deps.setThreadRead(channelId, threadTs, previousTs))) {
        feedback.flash(ts, "Failed to mark as unread.", "error");
        return false;
      }
      return true;
    }
    const list = messagesByChannel[channelId] ?? [];
    const idx = list.findIndex((m) => m.ts === ts);
    const atRealStart = idx === 0 && !deps.hasMoreHistory(channelId);
    const previousTs =
      idx > 0
        ? defined(list[idx - 1]).ts
        : atRealStart
          ? parseTs("0")
          : tsJustBefore(ts);
    const previousMs = tsToMs(previousTs);
    const priorLastRead = deps.lastReadFor(channelId);
    deps.setLastReadByChannel(channelId, previousMs);
    deps.setUnreadDividerTs(channelId, previousMs);
    deps.setUnreadChannelIds(channelId, true);
    if (!(await deps.setChannelRead(channelId, previousTs))) {
      deps.setLastReadByChannel(channelId, priorLastRead ?? 0);
      deps.setUnreadDividerTs(channelId, priorLastRead ?? Infinity);
      deps.setUnreadChannelIds(channelId, false);
      feedback.flash(ts, "Failed to mark as unread.", "error");
      return false;
    }
    return true;
  }
  return {
    isThreadSubscribed,
    isThreadSubscriptionPending,
    isThreadUnsubscribed,
    markCurrentChannelRead,
    isMessageUnread,
    markMessageUnread,
    toggleMessageUnread,
    toggleThreadSubscribed,
    unsubscribeFromThread,
  };
}
