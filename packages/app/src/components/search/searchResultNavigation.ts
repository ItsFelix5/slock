import type { SearchResult } from "@slock/slack-api";

export interface SearchResultNavigator {
  openChannelMessage: (channelId: string, ts: string, options?: { keepNav?: boolean }) => void;
  openChannelPeek: (
    channelId: string,
    ts: string,
    highlightTs?: string,
    options?: { keepNav?: boolean },
  ) => void;
}

export function navigateToSearchResult(result: SearchResult, navigator: SearchResultNavigator) {
  if (result.threadTs && result.threadTs !== result.ts) {
    navigator.openChannelPeek(result.channelId, result.threadTs, result.ts, { keepNav: true });
    return;
  }
  navigator.openChannelMessage(result.channelId, result.ts, { keepNav: true });
}
