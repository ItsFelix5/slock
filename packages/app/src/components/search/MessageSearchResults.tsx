import { Mrkdwn } from "@slock/blockkit";
import { formatTime, type SearchResult } from "@slock/slack-api";
import { Button, DEFAULT_AVATAR_COLOR, Icon } from "@slock/ui";
import { For, Show } from "solid-js";
import { dmDisplayName, store } from "../../lib/store";
import ResultMessageCard from "../messages/parts/ResultMessageCard";
import { openConversationInSplit } from "../navigation/SplitNavigation";

export default function MessageSearchResults(props: {
  canSearch: boolean;
  loading: boolean;
  onHistorySearch: (query: string) => void;
  onResult: (result: SearchResult) => void;
  onRetry: () => void;
  results: SearchResult[];
  searchError: boolean;
}) {
  return (
    <div aria-busy={props.loading} class="message-search-results">
      <Show
        fallback={
          <Show
            fallback={
              <div class="global-search-hint empty-state">
                Search every message, person, or conversation.
              </div>
            }
            when={store.searchHistory.searchHistory().length > 0}
          >
            <div class="message-search-history">
              <div class="message-search-history-header">
                <span class="global-search-filter-label">Recent searches</span>
              </div>
              <For each={store.searchHistory.searchHistory()}>
                {(query) => (
                  <div class="message-search-history-item">
                    <button
                      class="global-search-result message-search-history-query btn-reset flex-align-center"
                      onClick={() => props.onHistorySearch(query)}
                      type="button"
                    >
                      <Icon class="global-search-jump-icon" name="search" size={13} />
                      {query}
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        }
        when={props.canSearch}
      >
        <Show
          fallback={<div class="global-search-hint empty-state">Searching messages…</div>}
          when={!props.loading || props.results.length > 0}
        >
          <Show
            fallback={
              <div class="message-search-error empty-state" role="alert">
                <span>Couldn’t search messages.</span>
                <Button onClick={props.onRetry} size="sm">
                  Try again
                </Button>
              </div>
            }
            when={!props.searchError}
          >
            <Show
              fallback={<div class="message-search-empty empty-state">No matches.</div>}
              when={props.results.length > 0}
            >
              <For each={props.results}>
                {(result) => {
                  const user = () =>
                    result.userId ? store.users.userById(result.userId) : undefined;
                  const channelLabel = () => {
                    const dm = store.dms.dmById(result.channelId);
                    if (dm) return dmDisplayName(dm, store.users.userById);
                    if (result.channelName?.startsWith("mpdm-")) {
                      store.dms.ensureMpdm(result.channelId);
                      return "Group message";
                    }
                    return `#${result.channelName ?? result.channelId}`;
                  };
                  return (
                    <ResultMessageCard
                      avatarUser={{
                        avatarColor: user()?.avatarColor ?? DEFAULT_AVATAR_COLOR,
                        avatarUrl: user()?.avatarUrl,
                        id: result.userId,
                        name: user()?.name ?? "Someone",
                      }}
                      context={channelLabel()}
                      name={user()?.name ?? "Someone"}
                      navRow
                      onOpen={() => props.onResult(result)}
                      onSplit={() =>
                        openConversationInSplit(result.channelId, result.threadTs ?? result.ts)
                      }
                      snippet={<Mrkdwn text={result.text} />}
                      time={formatTime(result.ts)}
                    />
                  );
                }}
              </For>
            </Show>
          </Show>
        </Show>
      </Show>
    </div>
  );
}
