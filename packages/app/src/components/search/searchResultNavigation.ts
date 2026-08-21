import type { SearchResult } from "../../lib/api";
import {
  navigateToSlackPermalink,
  type SlackPermalinkNavigator,
} from "../../lib/navigation/slackPermalink";

export function navigateToSearchResult(
  result: SearchResult,
  navigator: SlackPermalinkNavigator,
  options?: { keepNav?: boolean },
) {
  navigateToSlackPermalink(
    { channelId: result.channelId, messageTs: result.ts, threadTs: result.threadTs ?? result.ts },
    navigator,
    options,
  );
}
