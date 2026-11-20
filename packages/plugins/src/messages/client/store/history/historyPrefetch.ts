import { service } from "@slock/core/solid";
import type { ChannelId } from "@slock/types";
import type { MessageHistoryApi } from "../messageHistory";

const TTL_MS = 10_000;

const env = service("env");

type Entry = {
  at: number;
  history: ReturnType<MessageHistoryApi["fetchHistory"]>;
  view: ReturnType<MessageHistoryApi["fetchConversationView"]>;
};

export function createHistoryPrefetch(
  api: Pick<MessageHistoryApi, "fetchConversationView" | "fetchHistory">,
  isLoaded: (channelId: ChannelId) => boolean,
) {
  const entries = new Map<ChannelId, Entry>();
  const isFresh = (entry: Entry) => env.now() - entry.at < TTL_MS;
  const start = (channelId: ChannelId): Entry => ({
    at: env.now(),
    history: api.fetchHistory(channelId),
    view: api.fetchConversationView(channelId),
  });

  return {
    prefetch(channelId: ChannelId) {
      const known = entries.get(channelId);
      if ((known && isFresh(known)) || isLoaded(channelId)) return;
      const entry = start(channelId);
      const drop = () => {
        if (entries.get(channelId) === entry) entries.delete(channelId);
      };
      entry.history.catch(drop);
      entry.view.catch(drop);
      entries.set(channelId, entry);
    },
    take(channelId: ChannelId): Entry {
      const entry = entries.get(channelId);
      entries.delete(channelId);
      return entry && isFresh(entry) ? entry : start(channelId);
    },
  };
}
