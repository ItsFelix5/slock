import { defined } from "@slock/core";
import { createFlags, service } from "@slock/core/solid";
import { toggleThreadSubscription } from "@slock/plugins/slack/client/api";
import { parseTs } from "@slock/slack";
import type { ChannelId, Message, Ts } from "@slock/types";
import { tsFromMs, tsJustBefore, tsToMs } from "../lib/tsTime";

const feedback = service("feedback");
const env = service("env");

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
  const threadSubscriptionPending = createFlags<string>();
  const threadUnsubscribed = createFlags<string>();
  const subscriptionPendingKey = (channelId: ChannelId, ts: Ts) => `${channelId}:${ts}`;
  const isThreadSubscriptionPending = (channelId: ChannelId, ts: Ts) =>
    threadSubscriptionPending.has(subscriptionPendingKey(channelId, ts));
  const isThreadUnsubscribed = (channelId: ChannelId, ts: Ts) =>
    threadUnsubscribed.has(subscriptionPendingKey(channelId, ts));
  function isThreadSubscribed(ts: Ts): boolean {
    return !!threadMessages[ts]?.[0]?.isSubscribed;
  }
  async function changeThreadSubscription(channelId: ChannelId, ts: Ts, wasSubscribed: boolean) {
    const key = subscriptionPendingKey(channelId, ts);
    if (threadSubscriptionPending.has(key)) return;
    const apply = (subscribed: boolean) => {
      patchMessage(channelId, ts, { isSubscribed: subscribed });
      threadUnsubscribed.set(key, !subscribed);
    };
    threadSubscriptionPending.set(key, true);
    apply(!wasSubscribed);
    try {
      await toggleThreadSubscription(channelId, ts, wasSubscribed);
    } catch (err) {
      console.error("Failed to update thread subscription", err);
      feedback.flash(ts, "Failed to update thread subscription.", "error");
      apply(wasSubscribed);
    } finally {
      threadSubscriptionPending.set(key, false);
    }
  }

  const toggleThreadSubscribed = (channelId: ChannelId, ts: Ts) =>
    changeThreadSubscription(channelId, ts, isThreadSubscribed(ts));

  const unsubscribeFromThread = (channelId: ChannelId, ts: Ts) =>
    changeThreadSubscription(channelId, ts, true);
  async function markCurrentChannelRead(channelId: ChannelId): Promise<boolean> {
    const loadedLatest = deps.hasNewerHistory(channelId)
      ? undefined
      : messagesByChannel[channelId]?.at(-1)?.ts;
    const latest = loadedLatest ?? tsFromMs(env.now());
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
  async function moveReadMarker(
    channelId: ChannelId,
    readTs: Ts,
    options: { flashKey: Ts; failure: string; markUnread: boolean },
  ): Promise<boolean> {
    const priorLastRead = deps.lastReadFor(channelId);
    const priorDivider = deps.unreadDividerTsFor(channelId);
    const readMs = tsToMs(readTs);
    deps.setLastReadByChannel(channelId, readMs);
    deps.setUnreadDividerTs(channelId, readMs);
    if (options.markUnread) deps.setUnreadChannelIds(channelId, true);
    if (await deps.setChannelRead(channelId, readTs)) return true;
    deps.setLastReadByChannel(channelId, priorLastRead ?? 0);
    deps.setUnreadDividerTs(channelId, priorDivider ?? Infinity);
    if (options.markUnread) deps.setUnreadChannelIds(channelId, false);
    feedback.flash(options.flashKey, options.failure, "error");
    return false;
  }
  async function markMessageRead(channelId: ChannelId, ts: Ts): Promise<boolean> {
    const moved = await moveReadMarker(channelId, ts, {
      failure: "Failed to mark as read.",
      flashKey: ts,
      markUnread: false,
    });
    if (!moved) return false;
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
  async function markMessageUnread(channelId: ChannelId, ts: Ts, threadTs?: Ts): Promise<boolean> {
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
      idx > 0 ? defined(list[idx - 1]).ts : atRealStart ? parseTs("0") : tsJustBefore(ts);
    return moveReadMarker(channelId, previousTs, {
      failure: "Failed to mark as unread.",
      flashKey: ts,
      markUnread: true,
    });
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
