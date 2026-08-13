import type { Channel, DirectMessage, Message } from "@slock/slack-api";
import { markChannelRead, markThreadRead } from "@slock/slack-api";
import { createEffect, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { actionFeedback } from "../feedback";
import type { ThreadRef, View } from "../types";
import { createLatestValueSync } from "./readSync/latestValueSync";

export function isUnreadDividerBoundary(
  ts: string,
  prevTs: string | undefined,
  anchor: number,
): boolean {
  return (
    parseFloat(ts) * 1000 > anchor && (prevTs === undefined || parseFloat(prevTs) * 1000 <= anchor)
  );
}

export function findUnreadDividerIndex(messages: Message[], anchor: number | undefined): number {
  if (anchor == null || !Number.isFinite(anchor)) return -1;
  return messages.findIndex((msg, index) =>
    isUnreadDividerBoundary(msg.ts, messages[index - 1]?.ts, anchor),
  );
}

export function createUnreadSlice(deps: {
  patchChannel: (id: string, patch: Partial<Channel>) => void;
  patchDm: (id: string, patch: Partial<DirectMessage>) => void;
  bootstrap: () =>
    | {
        channels: Channel[];
        directMessages: DirectMessage[];
        lastReadByChannel: Record<string, number>;
      }
    | undefined;
}) {
  const [unreadChannelIds, setUnreadChannelIds] = createStore<Record<string, boolean>>({});

  let unreadIdsSeeded = false;
  createEffect(() => {
    const data = deps.bootstrap();
    if (!data || unreadIdsSeeded) return;
    unreadIdsSeeded = true;
    for (const c of data.channels) if (c.unread) setUnreadChannelIds(c.id, true);
    for (const dm of data.directMessages) if (dm.unread) setUnreadChannelIds(dm.id, true);
  });

  const [lastReadByChannel, setLastReadByChannel] = createStore<Record<string, number>>({});

  const [unreadDividerTs, setUnreadDividerTs] = createStore<Record<string, number | undefined>>({});

  const [lastReadSeeded, setLastReadSeeded] = createSignal(false);
  createEffect(() => {
    const data = deps.bootstrap();
    if (!data || lastReadSeeded()) return;
    setLastReadSeeded(true);
    for (const [id, ts] of Object.entries(data.lastReadByChannel)) setLastReadByChannel(id, ts);
  });

  const isChannelGoneError = (error: unknown) =>
    error instanceof Error && error.message === "channel_not_found";

  const channelReadSync = createLatestValueSync<{
    channelId: string;
    ts: string;
  }>({
    key: (cursor) => cursor.channelId,
    onError: (cursor, error) => {
      if (isChannelGoneError(error)) return true;
      console.error("Failed to sync channel read cursor", error);
      actionFeedback.flash(cursor.channelId, "Couldn't sync read state.", "error");
    },
    version: (cursor) => parseFloat(cursor.ts),
    write: async (cursor) => {
      await markChannelRead(cursor.channelId, cursor.ts);
    },
  });
  const threadReadSync = createLatestValueSync<{
    channelId: string;
    threadTs: string;
    ts: string;
  }>({
    key: (cursor) => `${cursor.channelId}:${cursor.threadTs}`,
    onError: (cursor, error) => {
      if (isChannelGoneError(error)) return true;
      console.error("Failed to sync thread read cursor", cursor, error);
      actionFeedback.flash(cursor.threadTs, "Couldn't sync thread read state.", "error");
    },
    version: (cursor) => parseFloat(cursor.ts),
    write: async (cursor) => {
      await markThreadRead(cursor.channelId, cursor.threadTs, cursor.ts);
    },
  });

  function syncChannelRead(channelId: string, ts: string): Promise<boolean> {
    return channelReadSync.requestLatest({ channelId, ts });
  }

  function setChannelRead(channelId: string, ts: string): Promise<boolean> {
    return channelReadSync.force({ channelId, ts });
  }

  function syncThreadRead(channelId: string, threadTs: string, ts: string): Promise<boolean> {
    return threadReadSync.requestLatest({ channelId, threadTs, ts });
  }

  function clearChannelUnread(channelId: string) {
    setUnreadChannelIds(channelId, false);
    if (channelId.startsWith("D")) deps.patchDm(channelId, { mentions: 0 });
    else deps.patchChannel(channelId, { mentions: 0 });
  }

  function unreadDividerTsForChannel(channelId: string) {
    return unreadDividerTs[channelId];
  }

  function wireReadTracking(readDeps: {
    visibleViews: () => View[];
    messagesByChannel: Record<string, Message[]>;
    visibleThreads: () => ThreadRef[];
    threadMessages: Record<string, Message[]>;
  }) {
    const dividerAnchoredChannels = new Set<string>();
    createEffect(() => {
      if (!lastReadSeeded()) return;
      for (const { id } of readDeps.visibleViews()) {
        if (dividerAnchoredChannels.has(id)) continue;

        const list = readDeps.messagesByChannel[id];
        if (!list?.length) continue;
        dividerAnchoredChannels.add(id);
        const lastRead = lastReadByChannel[id] ?? 0;
        const latest = list[list.length - 1];

        const hasUnreadGap = !!latest && lastRead > 0 && parseFloat(latest.ts) * 1000 > lastRead;
        const anchor = hasUnreadGap ? lastRead : Infinity;
        setUnreadDividerTs(id, anchor);
      }
    });

    let previousVisibleIds = new Set<string>();
    createEffect(() => {
      const currentIds = new Set(readDeps.visibleViews().map((v) => v.id));
      for (const id of previousVisibleIds) {
        if (!currentIds.has(id)) {
          dividerAnchoredChannels.delete(id);
          setUnreadDividerTs(id, undefined);
        }
      }
      previousVisibleIds = currentIds;
    });

    const lastMarkedReadTs: Record<string, string> = {};
    createEffect(() => {
      for (const view of readDeps.visibleViews()) {
        if (unreadDividerTs[view.id] === undefined) continue;
        const list = readDeps.messagesByChannel[view.id];
        const latest = list?.[list.length - 1];
        if (!latest || latest.id.startsWith("pending-")) continue;
        if (lastMarkedReadTs[view.id] === latest.ts) continue;
        lastMarkedReadTs[view.id] = latest.ts;
        clearChannelUnread(view.id);
        setLastReadByChannel(view.id, parseFloat(latest.ts) * 1000);
        void syncChannelRead(view.id, latest.ts).then((synced) => {
          if (!synced && lastMarkedReadTs[view.id] === latest.ts) delete lastMarkedReadTs[view.id];
        });
      }
    });

    const lastMarkedThreadReadTs: Record<string, string> = {};
    createEffect(() => {
      for (const thread of readDeps.visibleThreads()) {
        const list = readDeps.threadMessages[thread.ts];

        const root = list?.find((m) => m.ts === thread.ts);
        if (!root?.isSubscribed) continue;

        const latest = list?.findLast((m) => !m.deleted);

        if (!latest || latest.ts === thread.ts || latest.id.startsWith("pending-")) continue;
        if (lastMarkedThreadReadTs[thread.ts] === latest.ts) continue;
        lastMarkedThreadReadTs[thread.ts] = latest.ts;
        void syncThreadRead(thread.channelId, thread.ts, latest.ts).then((synced) => {
          if (!synced && lastMarkedThreadReadTs[thread.ts] === latest.ts)
            delete lastMarkedThreadReadTs[thread.ts];
        });
      }
    });
  }

  return {
    clearChannelUnread,
    lastReadByChannel,
    setLastReadByChannel,
    setChannelRead,
    setUnreadChannelIds,
    setUnreadDividerTs,
    syncChannelRead,
    syncThreadRead,
    unreadChannelIds,
    unreadDividerTs,
    unreadDividerTsForChannel,
    wireReadTracking,
  };
}
