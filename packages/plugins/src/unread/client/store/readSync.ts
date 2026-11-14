import type { Services } from "@slock/core/types";
import { createLatestValueSync } from "../../../query/client/api";

export type ReadApi = {
  markChannelRead: (channelId: string, ts: string) => Promise<unknown>;
  markThreadRead: (channelId: string, threadTs: string, ts: string) => Promise<unknown>;
};

const hasErrorCode = (error: unknown, code: string) =>
  error instanceof Error && error.message === code;
const isChannelGoneError = (error: unknown) => hasErrorCode(error, "channel_not_found");
const isThreadGoneError = (error: unknown) =>
  isChannelGoneError(error) || hasErrorCode(error, "message_not_found");

export function createReadSync(api: ReadApi, flash: Services["feedback"]["flash"]) {
  const sentReadTs: Record<string, { all: Set<string>; latest: string }> = {};

  function recordSentRead(channelId: string, ts: string) {
    const sent = sentReadTs[channelId] ?? { all: new Set(), latest: ts };
    sentReadTs[channelId] = sent;
    sent.all.add(ts);
    sent.latest = ts;
  }

  function isStaleReadEcho(channelId: string, ts: string) {
    const sent = sentReadTs[channelId];
    return !!sent && sent.all.has(ts) && sent.latest !== ts;
  }

  const channelSync = createLatestValueSync<{ channelId: string; ts: string }>({
    key: (cursor) => cursor.channelId,
    onError: (cursor, error) => {
      if (isChannelGoneError(error)) return true;
      console.error("Failed to sync channel read cursor", error);
      flash(cursor.channelId, "Couldn't sync read state.", "error");
    },
    version: (cursor) => parseFloat(cursor.ts),
    write: async (cursor) => {
      await api.markChannelRead(cursor.channelId, cursor.ts);
    },
  });

  const threadSync = createLatestValueSync<{ channelId: string; threadTs: string; ts: string }>({
    key: (cursor) => `${cursor.channelId}:${cursor.threadTs}`,
    onError: (cursor, error) => {
      if (isThreadGoneError(error)) return true;
      console.error("Failed to sync thread read cursor", cursor, error);
      flash(cursor.threadTs, "Couldn't sync thread read state.", "error");
    },
    version: (cursor) => parseFloat(cursor.ts),
    write: async (cursor) => {
      await api.markThreadRead(cursor.channelId, cursor.threadTs, cursor.ts);
    },
  });

  return {
    isStaleReadEcho,
    setChannelRead(channelId: string, ts: string) {
      recordSentRead(channelId, ts);
      return channelSync.force({ channelId, ts });
    },
    setThreadRead: (channelId: string, threadTs: string, ts: string) =>
      threadSync.force({ channelId, threadTs, ts }),
    syncChannelRead(channelId: string, ts: string) {
      recordSentRead(channelId, ts);
      return channelSync.requestLatest({ channelId, ts });
    },
    syncThreadRead: (channelId: string, threadTs: string, ts: string) =>
      threadSync.requestLatest({ channelId, threadTs, ts }),
  };
}
