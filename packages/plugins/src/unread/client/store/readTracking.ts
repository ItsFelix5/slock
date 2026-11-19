import type { ChannelId, Message, Ts } from "@slock/types";
import { createEffect } from "solid-js";
import type { View } from "../../../conversations/client/api/types";
import type { ThreadRef } from "../../../messages/client/api";
import { isPendingMessage } from "../../../messages/client/api/messageMerge";

export type ReadTrackingInput = {
  visibleViews: () => View[];
  messagesByChannel: Record<string, Message[]>;
  visibleThreads: () => ThreadRef[];
  threadMessages: Record<string, Message[]>;
  hasNewerHistory: (channelId: ChannelId) => boolean;
};

type LatestMessage = { pending: boolean; ts: Ts };

type ChannelSnapshot = {
  hasDivider: boolean;
  hasList: boolean;
  hasNewer: boolean;
  id: ChannelId;
  lastRead: number | undefined;
  latest: LatestMessage | undefined;
  unread: boolean;
  viewed: boolean;
};

type ThreadSnapshot = {
  channelId: ChannelId;
  latest: LatestMessage | undefined;
  root: Message | undefined;
  ts: Ts;
  viewed: boolean;
};

export type ReadTrackingDeps = {
  clearChannelUnread: (channelId: ChannelId) => void;
  countsMayChange: Set<string>;
  isThreadUnread: (root: Message) => boolean;
  isViewed: (id: ChannelId | Ts) => boolean;
  lastReadByChannel: Record<string, number | undefined>;
  lastReadSeeded: () => boolean;
  setLastReadByChannel: (channelId: ChannelId, ms: number) => void;
  setThreadReadTs: (threadTs: Ts, ts: Ts | undefined) => void;
  setUnreadDividerTs: (channelId: ChannelId, anchor: number | undefined) => void;
  syncChannelRead: (channelId: ChannelId, ts: Ts) => Promise<boolean>;
  syncThreadRead: (channelId: ChannelId, threadTs: Ts, ts: Ts) => Promise<boolean>;
  threadKey: (channelId: ChannelId, threadTs: Ts) => string;
  unreadChannelIds: Record<string, boolean>;
  unreadDividerTs: Record<string, number | undefined>;
};

const toMs = (ts: Ts) => parseFloat(ts) * 1000;

function latestOf(list: Message[] | undefined, skipDeleted: boolean): LatestMessage | undefined {
  const message = skipDeleted ? list?.findLast((m) => !m.deleted) : list?.at(-1);
  return message && { pending: isPendingMessage(message), ts: message.ts };
}

export function wireReadTracking(deps: ReadTrackingDeps, input: ReadTrackingInput) {
  const dividerAnchored = new Set<ChannelId>();
  const lastMarkedRead = new Map<ChannelId, Ts>();
  const lastMarkedThreadRead = new Map<Ts, Ts>();
  let previousVisibleIds = new Set<ChannelId>();

  createEffect(
    () => {
      if (!deps.lastReadSeeded()) return [];
      return input.visibleViews().map(({ id }) => ({
        hasNewer: input.hasNewerHistory(id),
        id,
        lastRead: deps.lastReadByChannel[id] ?? 0,
        latest: latestOf(input.messagesByChannel[id], false),
      }));
    },
    (views) => {
      for (const { hasNewer, id, lastRead, latest } of views) {
        if (dividerAnchored.has(id) || hasNewer || !latest) continue;
        dividerAnchored.add(id);
        const hasUnreadGap = lastRead > 0 && toMs(latest.ts) > lastRead;
        deps.setUnreadDividerTs(id, hasUnreadGap ? lastRead : Infinity);
      }
    },
  );

  createEffect(
    () => new Set(input.visibleViews().map((v) => v.id)),
    (currentIds) => {
      for (const id of previousVisibleIds) {
        if (currentIds.has(id)) continue;
        dividerAnchored.delete(id);
        deps.setUnreadDividerTs(id, undefined);
      }
      previousVisibleIds = currentIds;
    },
  );

  createEffect(
    (): ChannelSnapshot[] =>
      input.visibleViews().map(({ id }) => ({
        hasDivider: deps.unreadDividerTs[id] !== undefined,
        hasList: !!input.messagesByChannel[id],
        hasNewer: input.hasNewerHistory(id),
        id,
        lastRead: deps.lastReadByChannel[id],
        latest: latestOf(input.messagesByChannel[id], false),
        unread: !!deps.unreadChannelIds[id],
        viewed: deps.isViewed(id),
      })),
    (snapshots) => {
      for (const view of snapshots) markChannelRead(view);
    },
  );

  function markChannelRead({
    hasDivider,
    hasNewer,
    id,
    lastRead,
    latest,
    unread,
    viewed,
  }: ChannelSnapshot) {
    if (!hasDivider || !viewed || hasNewer) return;
    if (!latest || latest.pending) return;
    const markedTs = lastMarkedRead.get(id);
    if (markedTs && (lastRead ?? 0) < toMs(markedTs)) return;
    if (markedTs === latest.ts) {
      if (unread) deps.clearChannelUnread(id);
      return;
    }
    lastMarkedRead.set(id, latest.ts);
    deps.clearChannelUnread(id);
    const latestMs = toMs(latest.ts);
    if (latestMs <= (lastRead ?? 0)) return;
    deps.setLastReadByChannel(id, latestMs);
    void deps.syncChannelRead(id, latest.ts).then((synced) => {
      if (!synced && lastMarkedRead.get(id) === latest.ts) lastMarkedRead.delete(id);
    });
  }

  createEffect(
    (): ThreadSnapshot[] =>
      input.visibleThreads().map(({ channelId, ts }) => {
        const list = input.threadMessages[ts];
        return {
          channelId,
          latest: latestOf(list, true),
          root: list?.find((m) => m.ts === ts),
          ts,
          viewed: deps.isViewed(ts),
        };
      }),
    (snapshots) => {
      for (const thread of snapshots) markThreadRead(thread);
    },
  );

  function markThreadRead({ channelId, latest, root, ts, viewed }: ThreadSnapshot) {
    if (!viewed || !root?.isSubscribed) return;
    if (!latest || latest.ts === ts || latest.pending) return;
    if (lastMarkedThreadRead.get(ts) === latest.ts) return;
    lastMarkedThreadRead.set(ts, latest.ts);
    if (deps.isThreadUnread(root)) deps.countsMayChange.add(deps.threadKey(channelId, ts));
    deps.setThreadReadTs(ts, latest.ts);
    void deps.syncThreadRead(channelId, ts, latest.ts).then((synced) => {
      if (!synced && lastMarkedThreadRead.get(ts) === latest.ts) lastMarkedThreadRead.delete(ts);
    });
  }
}
