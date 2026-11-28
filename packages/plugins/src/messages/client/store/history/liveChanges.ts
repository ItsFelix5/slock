import { compareTs, withReaction } from "@slock/slack";
import type { ChannelId, HistoryPage, Message, Ts, UserId } from "@slock/types";
import type { MessageHistoryApi } from "./historyApi";

export type LiveChange = { channelId: ChannelId; ts: Ts } & (
  | { edit: Partial<Message> }
  | { reaction: { added: boolean; name: string; userId: UserId } }
);

type Logged = LiveChange & { seq: number };

const isNewerEdit = (edit: Partial<Message>, message: Message) =>
  !!edit.editedTs && !(message.editedTs && compareTs(message.editedTs, edit.editedTs) >= 0);

function applyChange(message: Message, change: Logged): Message {
  if ("edit" in change)
    return isNewerEdit(change.edit, message) ? { ...message, ...change.edit } : message;
  const { added, name, userId } = change.reaction;
  const reactions = message.reactions ?? [];
  const next = withReaction(reactions, name, userId, added);
  return next === reactions ? message : { ...message, reactions: next };
}

export function createLiveChanges() {
  let seq = 0;
  let log: Logged[] = [];
  const running = new Set<{ from: number }>();

  function record(change: LiveChange) {
    if (running.size) log.push({ ...change, seq: ++seq });
  }

  async function replayOver(channelId: ChannelId, request: () => Promise<HistoryPage>) {
    const run = { from: seq };
    running.add(run);
    try {
      const page = await request();
      const newer = log.filter((change) => change.seq > run.from && change.channelId === channelId);
      if (newer.length === 0) return page;
      return {
        ...page,
        messages: page.messages.map((message) =>
          newer.filter((change) => change.ts === message.ts).reduce(applyChange, message),
        ),
      };
    } finally {
      running.delete(run);
      const oldest = Math.min(...[...running].map((other) => other.from));
      log = log.filter((change) => change.seq > oldest);
    }
  }

  return {
    guard: (api: MessageHistoryApi): MessageHistoryApi => ({
      ...api,
      fetchHistory: (channelId, cursor) =>
        replayOver(channelId, () => api.fetchHistory(channelId, cursor)),
      fetchHistoryAround: (channelId, ts) =>
        replayOver(channelId, () => api.fetchHistoryAround(channelId, ts)),
      fetchHistoryNewer: (channelId, oldest, spanHint) =>
        replayOver(channelId, () => api.fetchHistoryNewer(channelId, oldest, spanHint)),
    }),
    record,
  };
}
