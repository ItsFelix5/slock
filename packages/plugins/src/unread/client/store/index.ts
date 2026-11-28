import type { Services } from "@slock/core/types";
import { isDmId } from "@slock/plugins/dms/client/api";
import type { Channel, ChannelId, DirectMessage, Message, Ts } from "@slock/types";
import { createEffect, createSignal, createStore } from "solid-js";
import { createReadSync, type ReadApi } from "./readSync";
import { type ReadTrackingInput, wireReadTracking } from "./readTracking";
import { createViewState } from "./viewState";

type BootstrapCounts = {
  channels: Channel[];
  countsLoaded: boolean;
  directMessages: DirectMessage[];
  lastReadByChannel: Record<ChannelId, number>;
};

export function createUnreadStore(deps: {
  api: ReadApi;
  flash: Services["feedback"]["flash"];
  patchChannel: (id: ChannelId, patch: Partial<Channel>) => void;
  patchDm: (id: ChannelId, patch: Partial<DirectMessage>) => void;
  bootstrap: () => BootstrapCounts | undefined;
}) {
  const [unreadChannelIds, setUnreadChannelIdsStore] = createStore<Record<string, boolean>>({});
  const [lastReadByChannel, setLastReadByChannelStore] = createStore<Record<string, number>>({});
  const [threadReadTs, setThreadReadTsStore] = createStore<Record<string, Ts | undefined>>({});
  const [unreadDividerTs, setUnreadDividerTsStore] = createStore<
    Record<string, number | undefined>
  >({});
  const [lastReadSeeded, setLastReadSeeded] = createSignal(false);
  const { isViewed, setBottomSeen, trackBottomSeen } = createViewState();

  const setUnreadChannelIds = (id: ChannelId, unread: boolean) =>
    setUnreadChannelIdsStore((state) => {
      state[id] = unread;
    });
  const setLastReadByChannel = (id: ChannelId, ms: number) =>
    setLastReadByChannelStore((state) => {
      state[id] = ms;
    });
  const setThreadReadTs = (threadTs: Ts, ts: Ts | undefined) =>
    setThreadReadTsStore((state) => {
      state[threadTs] = ts;
    });
  const setUnreadDividerTs = (id: ChannelId, anchor: number | undefined) =>
    setUnreadDividerTsStore((state) => {
      state[id] = anchor;
    });

  createEffect(
    () => {
      const data = deps.bootstrap();
      return data?.countsLoaded && !lastReadSeeded() ? data : undefined;
    },
    (data) => {
      if (!data) return;
      setUnreadChannelIdsStore((state) => {
        for (const c of data.channels) if (c.unread) state[c.id] = true;
        for (const dm of data.directMessages) if (dm.unread) state[dm.id] = true;
      });
      setLastReadByChannelStore((state) => {
        for (const [id, ts] of Object.entries(data.lastReadByChannel)) state[id] = ts;
      });
      setLastReadSeeded(true);
    },
  );

  const readSync = createReadSync(deps.api, deps.flash);
  const { isStaleReadEcho, setChannelRead, syncChannelRead, syncThreadRead } = readSync;

  async function setThreadRead(channelId: ChannelId, threadTs: Ts, ts: Ts): Promise<boolean> {
    const prior = threadReadTs[threadTs];
    setThreadReadTs(threadTs, ts);
    const synced = await readSync.setThreadRead(channelId, threadTs, ts);
    if (!synced) setThreadReadTs(threadTs, prior);
    return synced;
  }

  function clearChannelUnread(channelId: ChannelId) {
    setUnreadChannelIds(channelId, false);
    const isDm = isDmId(
      channelId,
      (id) => !!deps.bootstrap()?.directMessages.some((dm) => dm.id === id),
    );
    if (isDm) deps.patchDm(channelId, { mentions: 0 });
    else deps.patchChannel(channelId, { mentions: 0 });
  }

  function isThreadUnread(root: Message) {
    const readTs = threadReadTs[root.ts] ?? root.threadLastRead ?? root.ts;
    return !!root.isSubscribed && !!root.latestReply && root.latestReply > readTs;
  }

  return {
    clearChannelUnread,
    isChannelUnread: (channelId: ChannelId) => !!unreadChannelIds[channelId],
    isStaleReadEcho,
    isThreadUnread,
    isViewed,
    lastReadByChannel,
    lastReadFor: (channelId: ChannelId): number | undefined => lastReadByChannel[channelId],
    setBottomSeen,
    setChannelRead,
    setLastReadByChannel,
    setThreadRead,
    setThreadReadTs,
    setUnreadChannelIds,
    setUnreadDividerTs,
    syncChannelRead,
    syncThreadRead,
    trackBottomSeen,
    threadReadTsFor: (threadTs: Ts): Ts | undefined => threadReadTs[threadTs],
    unreadChannelIds,
    unreadDividerTs,
    unreadDividerTsForChannel: (channelId: ChannelId): number | undefined =>
      unreadDividerTs[channelId],
    wireReadTracking: (input: ReadTrackingInput) =>
      wireReadTracking(
        {
          clearChannelUnread,
          isViewed,
          lastReadByChannel,
          lastReadSeeded,
          setLastReadByChannel,
          setThreadReadTs,
          setUnreadDividerTs,
          syncChannelRead,
          syncThreadRead,
          unreadChannelIds,
          unreadDividerTs,
        },
        input,
      ),
  };
}
