import type { SearchResult } from "@slock/slack-api";

export interface SearchResultNavigator {
  openChannelMessage: (channelId: string, ts: string) => void;
  openChannelPeek: (channelId: string, ts: string, highlightTs?: string) => void;
}

export function navigateToSearchResult(result: SearchResult, navigator: SearchResultNavigator) {
  if (result.threadTs && result.threadTs !== result.ts) {
    navigator.openChannelPeek(result.channelId, result.threadTs, result.ts);
    return;
  }
  navigator.openChannelMessage(result.channelId, result.ts);
}
