import type { Services } from "@slock/core/types";
import { defineMutation } from "@slock/plugins/query/client/api";
import type { ChannelId, Ts } from "@slock/types";

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

  const channelSync = defineMutation<{ channelId: ChannelId; ts: Ts }, unknown>({
    key: (cursor) => cursor.channelId,
    mode: "latest",
    onError: (error, cursor) => {
      console.error("Failed to sync channel read cursor", error);
      flash(cursor.channelId, "Couldn't sync read state.", "error");
    },
    run: (cursor) => api.markChannelRead(cursor.channelId, cursor.ts),
    settles: isChannelGoneError,
    version: (cursor) => parseFloat(cursor.ts),
  });

  const threadSync = defineMutation<{ channelId: ChannelId; threadTs: Ts; ts: Ts }, unknown>({
    key: (cursor) => `${cursor.channelId}:${cursor.threadTs}`,
    mode: "latest",
    onError: (error, cursor) => {
      console.error("Failed to sync thread read cursor", cursor, error);
      flash(cursor.threadTs, "Couldn't sync thread read state.", "error");
    },
    run: (cursor) => api.markThreadRead(cursor.channelId, cursor.threadTs, cursor.ts),
    settles: isThreadGoneError,
    version: (cursor) => parseFloat(cursor.ts),
  });

  return {
    isStaleReadEcho,
    setChannelRead(channelId: ChannelId, ts: Ts) {
      recordSentRead(channelId, ts);
      return channelSync.run({ channelId, ts }, { force: true });
    },
    setThreadRead: (channelId: ChannelId, threadTs: Ts, ts: Ts) =>
      threadSync.run({ channelId, threadTs, ts }, { force: true }),
    syncChannelRead(channelId: ChannelId, ts: Ts) {
      recordSentRead(channelId, ts);
      return channelSync.run({ channelId, ts });
    },
    syncThreadRead: (channelId: ChannelId, threadTs: Ts, ts: Ts) =>
      threadSync.run({ channelId, threadTs, ts }),
  };
}
