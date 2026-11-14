import type { fetchConversationView, fetchHistory } from "../../../../slack/client/api";

const TTL_MS = 10_000;

type Entry = {
  at: number;
  history: ReturnType<typeof fetchHistory>;
  view: ReturnType<typeof fetchConversationView>;
};

export function createHistoryPrefetch(
  api: { fetchConversationView: typeof fetchConversationView; fetchHistory: typeof fetchHistory },
  isLoaded: (channelId: string) => boolean,
) {
  const entries = new Map<string, Entry>();
  const isFresh = (entry: Entry) => Date.now() - entry.at < TTL_MS;
  const start = (channelId: string): Entry => ({
    at: Date.now(),
    history: api.fetchHistory(channelId),
    view: api.fetchConversationView(channelId),
  });

  return {
    prefetch(channelId: string) {
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
    take(channelId: string): Entry {
      const entry = entries.get(channelId);
      entries.delete(channelId);
      return entry && isFresh(entry) ? entry : start(channelId);
    },
  };
}
