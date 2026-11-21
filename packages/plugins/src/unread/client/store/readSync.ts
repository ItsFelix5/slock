import type { Services } from "@slock/core/types";
import type { ChannelId, Ts } from "@slock/types";
import { createLatestValueSync } from "../../../query/client/api";

export type ReadApi = {
  markChannelRead: (channelId: ChannelId, ts: Ts) => Promise<unknown>;
  markThreadRead: (channelId: ChannelId, threadTs: Ts, ts: Ts) => Promise<unknown>;
};

const hasErrorCode = (error: unknown, code: string) =>
  error instanceof Error && error.message === code;
const isChannelGoneError = (error: unknown) => hasErrorCode(error, "channel_not_found");
const isThreadGoneError = (error: unknown) =>
  isChannelGoneError(error) || hasErrorCode(error, "message_not_found");

export function createReadSync(api: ReadApi, flash: Services["feedback"]["flash"]) {
  const sentReadTs: Record<string, { all: Set<string>; latest: string }> = {};

  function recordSentRead(channelId: ChannelId, ts: Ts) {
    const sent = sentReadTs[channelId] ?? { all: new Set(), latest: ts };
    sentReadTs[channelId] = sent;
    sent.all.add(ts);
    sent.latest = ts;
  }

  function isStaleReadEcho(channelId: ChannelId, ts: Ts) {
    const sent = sentReadTs[channelId];
    return !!sent && sent.all.has(ts) && sent.latest !== ts;
  }

  const channelSync = createLatestValueSync<{ channelId: ChannelId; ts: Ts }>({
    key: (cursor) => cursor.channelId,
    onError: (cursor, error) => {
      if (isChannelGoneError(error)) return true;
      console.error("Failed to sync channel read cursor", error);
      flash(cursor.channelId, "Couldn't sync read state.", "error");
      return false;
    },
    version: (cursor) => parseFloat(cursor.ts),
    write: async (cursor) => {
      await api.markChannelRead(cursor.channelId, cursor.ts);
    },
  });

  const threadSync = createLatestValueSync<{ channelId: ChannelId; threadTs: Ts; ts: Ts }>({
    key: (cursor) => `${cursor.channelId}:${cursor.threadTs}`,
    onError: (cursor, error) => {
      if (isThreadGoneError(error)) return true;
      console.error("Failed to sync thread read cursor", cursor, error);
      flash(cursor.threadTs, "Couldn't sync thread read state.", "error");
      return false;
    },
    version: (cursor) => parseFloat(cursor.ts),
    write: async (cursor) => {
      await api.markThreadRead(cursor.channelId, cursor.threadTs, cursor.ts);
    },
  });

  return {
    isStaleReadEcho,
    setChannelRead(channelId: ChannelId, ts: Ts) {
      recordSentRead(channelId, ts);
      return channelSync.force({ channelId, ts });
    },
    setThreadRead: (channelId: ChannelId, threadTs: Ts, ts: Ts) =>
      threadSync.force({ channelId, threadTs, ts }),
    syncChannelRead(channelId: ChannelId, ts: Ts) {
      recordSentRead(channelId, ts);
      return channelSync.requestLatest({ channelId, ts });
    },
    syncThreadRead: (channelId: ChannelId, threadTs: Ts, ts: Ts) =>
      threadSync.requestLatest({ channelId, threadTs, ts }),
  };
}
