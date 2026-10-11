import { service } from "@slock/core/solid";
import type { Channel, DirectMessage, Message } from "@slock/types";
import { createEffect, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { View } from "../../../conversations/client/api/types";
import { isDmId } from "../../../dms/client/api";
import type { ThreadRef } from "../../../messages/client/api";
import { isPendingMessage } from "../../../messages/client/api/messageMerge";
import { markChannelRead, markThreadRead } from "../../../slack/client/api";
import { createLatestValueSync } from "./latestValueSync";

const feedback = service("feedback");

export function createUnreadStore(deps: {
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

  const hasErrorCode = (error: unknown, code: string) =>
    error instanceof Error && error.message === code;
  const isChannelGoneError = (error: unknown) => hasErrorCode(error, "channel_not_found");
  const isThreadGoneError = (error: unknown) =>
    isChannelGoneError(error) || hasErrorCode(error, "message_not_found");

  const sentReadTs: Record<string, { all: Set<string>; latest: string }> = {};
  function recordSentRead({ channelId, ts }: { channelId: string; ts: string }) {
    const sent = sentReadTs[channelId] ?? { all: new Set(), latest: ts };
    sentReadTs[channelId] = sent;
    sent.all.add(ts);
    sent.latest = ts;
  }
  function isStaleReadEcho(channelId: string, ts: string) {
    const sent = sentReadTs[channelId];
    return !!sent && sent.all.has(ts) && sent.latest !== ts;
  }

  const channelReadSync = createLatestValueSync<{
    channelId: string;
    ts: string;
  }>({
    key: (cursor) => cursor.channelId,
    onError: (cursor, error) => {
      if (isChannelGoneError(error)) return true;
      console.error("Failed to sync channel read cursor", error);
      feedback.flash(cursor.channelId, "Couldn't sync read state.", "error");
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
      if (isThreadGoneError(error)) return true;
      console.error("Failed to sync thread read cursor", cursor, error);
      feedback.flash(cursor.threadTs, "Couldn't sync thread read state.", "error");
    },
    version: (cursor) => parseFloat(cursor.ts),
    write: async (cursor) => {
      await markThreadRead(cursor.channelId, cursor.threadTs, cursor.ts);
    },
  });

  function syncChannelRead(channelId: string, ts: string): Promise<boolean> {
    recordSentRead({ channelId, ts });
    return channelReadSync.requestLatest({ channelId, ts });
  }

  function setChannelRead(channelId: string, ts: string): Promise<boolean> {
    recordSentRead({ channelId, ts });
    return channelReadSync.force({ channelId, ts });
  }

  function syncThreadRead(channelId: string, threadTs: string, ts: string): Promise<boolean> {
    return threadReadSync.requestLatest({ channelId, threadTs, ts });
  }

  function setThreadRead(channelId: string, threadTs: string, ts: string): Promise<boolean> {
    return threadReadSync.force({ channelId, threadTs, ts });
  }

  function clearChannelUnread(channelId: string) {
    setUnreadChannelIds(channelId, false);
    const isDm = isDmId(
      channelId,
      (id) => !!deps.bootstrap()?.directMessages.some((dm) => dm.id === id),
    );
    if (isDm) deps.patchDm(channelId, { mentions: 0 });
    else deps.patchChannel(channelId, { mentions: 0 });
  }

  function unreadDividerTsForChannel(channelId: string) {
    return unreadDividerTs[channelId];
  }

  function isChannelUnread(channelId: string) {
    return !!unreadChannelIds[channelId];
  }

  function lastReadFor(channelId: string) {
    return lastReadByChannel[channelId];
  }

  function wireReadTracking(readDeps: {
    visibleViews: () => View[];
    messagesByChannel: Record<string, Message[]>;
    visibleThreads: () => ThreadRef[];
    threadMessages: Record<string, Message[]>;
    hasNewerHistory: (channelId: string) => boolean;
    onThreadRead: (channelId: string, threadTs: string) => void;
  }) {
    const dividerAnchoredChannels = new Set<string>();
    createEffect(() => {
      if (!lastReadSeeded()) return;
      for (const { id } of readDeps.visibleViews()) {
        if (dividerAnchoredChannels.has(id)) continue;
        if (readDeps.hasNewerHistory(id)) continue;

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
        if (readDeps.hasNewerHistory(view.id)) continue;
        const list = readDeps.messagesByChannel[view.id];
        const latest = list?.[list.length - 1];
        if (!latest || isPendingMessage(latest)) continue;
        const markedTs = lastMarkedReadTs[view.id];
        const readCursorLowered =
          markedTs && (lastReadByChannel[view.id] ?? 0) < parseFloat(markedTs) * 1000;
        if (readCursorLowered) continue;
        if (markedTs === latest.ts) {
          if (unreadChannelIds[view.id]) clearChannelUnread(view.id);
          continue;
        }
        lastMarkedReadTs[view.id] = latest.ts;
        clearChannelUnread(view.id);
        const latestMs = parseFloat(latest.ts) * 1000;
        if (latestMs <= (lastReadByChannel[view.id] ?? 0)) continue;
        setLastReadByChannel(view.id, latestMs);
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

        if (!latest || latest.ts === thread.ts || isPendingMessage(latest)) continue;
        if (lastMarkedThreadReadTs[thread.ts] === latest.ts) continue;
        lastMarkedThreadReadTs[thread.ts] = latest.ts;
        readDeps.onThreadRead(thread.channelId, thread.ts);
        void syncThreadRead(thread.channelId, thread.ts, latest.ts).then((synced) => {
          if (!synced && lastMarkedThreadReadTs[thread.ts] === latest.ts)
            delete lastMarkedThreadReadTs[thread.ts];
        });
      }
    });
  }

  return {
    clearChannelUnread,
    isChannelUnread,
    isStaleReadEcho,
    lastReadByChannel,
    lastReadFor,
    setLastReadByChannel,
    setChannelRead,
    setThreadRead,
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
