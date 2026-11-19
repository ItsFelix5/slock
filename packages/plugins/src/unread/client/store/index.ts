import type { Services } from "@slock/core/types";
import type { Channel, ChannelId, DirectMessage, Message, Ts } from "@slock/types";
import { createEffect, createSignal, createStore } from "solid-js";
import { isDmId } from "../../../dms/client/api";
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
  onReadSynced: () => void;
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
  const { isViewed, setBottomSeen } = createViewState();

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
      return data?.countsLoaded ? data : undefined;
    },
    (data) => {
      if (!data || lastReadSeeded()) return;
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

  const countsMayChange = new Set<string>();
  const threadKey = (channelId: ChannelId, threadTs: Ts) => `${channelId}:${threadTs}`;
  const afterWrite = async <T>(key: string, write: Promise<T>) => {
    const result = await write;
    if (countsMayChange.delete(key)) deps.onReadSynced();
    return result;
  };
  const readSync = createReadSync(
    {
      markChannelRead: (channelId, ts) =>
        afterWrite(channelId, deps.api.markChannelRead(channelId, ts)),
      markThreadRead: (channelId, threadTs, ts) =>
        afterWrite(
          threadKey(channelId, threadTs),
          deps.api.markThreadRead(channelId, threadTs, ts),
        ),
    },
    deps.flash,
  );
  const { isStaleReadEcho, syncThreadRead } = readSync;

  function setChannelRead(channelId: ChannelId, ts: Ts) {
    countsMayChange.add(channelId);
    return readSync.setChannelRead(channelId, ts);
  }

  function syncChannelRead(channelId: ChannelId, ts: Ts) {
    if (unreadChannelIds[channelId]) countsMayChange.add(channelId);
    return readSync.syncChannelRead(channelId, ts);
  }

  async function setThreadRead(channelId: ChannelId, threadTs: Ts, ts: Ts): Promise<boolean> {
    countsMayChange.add(threadKey(channelId, threadTs));
    const prior = threadReadTs[threadTs];
    setThreadReadTs(threadTs, ts);
    const synced = await readSync.setThreadRead(channelId, threadTs, ts);
    if (!synced) setThreadReadTs(threadTs, prior);
    return synced;
  }

  function clearChannelUnread(channelId: ChannelId) {
    if (unreadChannelIds[channelId]) countsMayChange.add(channelId);
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
    threadReadTsFor: (threadTs: Ts): Ts | undefined => threadReadTs[threadTs],
    unreadChannelIds,
    unreadDividerTs,
    unreadDividerTsForChannel: (channelId: ChannelId): number | undefined =>
      unreadDividerTs[channelId],
    wireReadTracking: (input: ReadTrackingInput) =>
      wireReadTracking(
        {
          clearChannelUnread,
          countsMayChange,
          isThreadUnread,
          isViewed,
          lastReadByChannel,
          lastReadSeeded,
          setLastReadByChannel,
          setThreadReadTs,
          setUnreadDividerTs,
          syncChannelRead,
          syncThreadRead,
          threadKey,
          unreadChannelIds,
          unreadDividerTs,
        },
        input,
      ),
  };
}
