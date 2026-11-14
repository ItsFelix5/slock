import type { Services } from "@slock/core/types";
import type { Channel, DirectMessage, Message } from "@slock/types";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import type { View } from "../../../conversations/client/api/types";
import { isDmId } from "../../../dms/client/api";
import type { ThreadRef } from "../../../messages/client/api";
import { isPendingMessage } from "../../../messages/client/api/messageMerge";
import { createReadSync, type ReadApi } from "./readSync";

export function createUnreadStore(deps: {
  api: ReadApi;
  flash: Services["feedback"]["flash"];
  patchChannel: (id: string, patch: Partial<Channel>) => void;
  patchDm: (id: string, patch: Partial<DirectMessage>) => void;
  bootstrap: () =>
    | {
        channels: Channel[];
        countsLoaded: boolean;
        directMessages: DirectMessage[];
        lastReadByChannel: Record<string, number>;
      }
    | undefined;
}) {
  const [unreadChannelIds, setUnreadChannelIds] = createStore<Record<string, boolean>>({});

  let unreadIdsSeeded = false;
  createEffect(() => {
    const data = deps.bootstrap();
    if (!data?.countsLoaded || unreadIdsSeeded) return;
    unreadIdsSeeded = true;
    for (const c of data.channels) if (c.unread) setUnreadChannelIds(c.id, true);
    for (const dm of data.directMessages) if (dm.unread) setUnreadChannelIds(dm.id, true);
  });

  const [lastReadByChannel, setLastReadByChannel] = createStore<Record<string, number>>({});

  const [threadReadTs, setThreadReadTs] = createStore<Record<string, string | undefined>>({});

  const [bottomSeen, setBottomSeen] = createStore<Record<string, boolean>>({});

  const isWindowActive = () => document.hasFocus() && document.visibilityState === "visible";
  const [windowActive, setWindowActive] = createSignal(isWindowActive());
  const syncWindowActive = () => setWindowActive(isWindowActive());
  window.addEventListener("focus", syncWindowActive);
  window.addEventListener("blur", syncWindowActive);
  document.addEventListener("visibilitychange", syncWindowActive);
  onCleanup(() => {
    window.removeEventListener("focus", syncWindowActive);
    window.removeEventListener("blur", syncWindowActive);
    document.removeEventListener("visibilitychange", syncWindowActive);
  });

  const isViewed = (id: string) => windowActive() && !!bottomSeen[id];

  const [unreadDividerTs, setUnreadDividerTs] = createStore<Record<string, number | undefined>>({});

  const [lastReadSeeded, setLastReadSeeded] = createSignal(false);
  createEffect(() => {
    const data = deps.bootstrap();
    if (!data?.countsLoaded || lastReadSeeded()) return;
    setLastReadSeeded(true);
    for (const [id, ts] of Object.entries(data.lastReadByChannel)) setLastReadByChannel(id, ts);
  });

  const readSync = createReadSync(deps.api, deps.flash);
  const { isStaleReadEcho, setChannelRead, syncChannelRead, syncThreadRead } = readSync;

  async function setThreadRead(channelId: string, threadTs: string, ts: string): Promise<boolean> {
    const prior = threadReadTs[threadTs];
    setThreadReadTs(threadTs, ts);
    const synced = await readSync.setThreadRead(channelId, threadTs, ts);
    if (!synced) setThreadReadTs(threadTs, prior);
    return synced;
  }

  function threadReadTsFor(threadTs: string) {
    return threadReadTs[threadTs];
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

  function isThreadUnread(root: Message) {
    const readTs = threadReadTs[root.ts] ?? root.threadLastRead ?? root.ts;
    return !!root.isSubscribed && !!root.latestReply && root.latestReply > readTs;
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
        if (!isViewed(view.id)) continue;
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
        if (!isViewed(thread.ts)) continue;
        const list = readDeps.threadMessages[thread.ts];

        const root = list?.find((m) => m.ts === thread.ts);
        if (!root?.isSubscribed) continue;

        const latest = list?.findLast((m) => !m.deleted);

        if (!latest || latest.ts === thread.ts || isPendingMessage(latest)) continue;
        if (lastMarkedThreadReadTs[thread.ts] === latest.ts) continue;
        lastMarkedThreadReadTs[thread.ts] = latest.ts;
        setThreadReadTs(thread.ts, latest.ts);
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
    isThreadUnread,
    isStaleReadEcho,
    isViewed,
    lastReadByChannel,
    lastReadFor,
    setBottomSeen,
    setLastReadByChannel,
    setChannelRead,
    setThreadRead,
    setThreadReadTs,
    threadReadTsFor,
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
