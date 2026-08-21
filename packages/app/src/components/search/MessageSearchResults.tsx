import { Mrkdwn } from "@slock/blockkit";
import {
  Button,
  ClickableInline,
  ContextMenu,
  createRovingFocus,
  DEFAULT_AVATAR_COLOR,
  Icon,
  IconButton,
  MenuItem,
  useContextMenu,
} from "@slock/ui";
import { For, Show } from "solid-js";
import { formatDay, formatTime, type SearchResult } from "../../lib/api";
import { channelIconName, dmDisplayName } from "../../lib/displayName";
import { copyMessageLink } from "../../lib/messageLinks";
import type { SortMode } from "../../lib/searchQuery";
import { store } from "../../lib/store";
import ResultMessageCard from "../messages/parts/ResultMessageCard";
import { openConversation, openConversationInSplit } from "../navigation/SplitNavigation";
import { SORT_OPTIONS } from "./messageSearchOptions";

export default function MessageSearchResults(props: {
  canSearch: boolean;
  loading: boolean;
  onHistorySearch: (query: string) => void;
  onResult: (result: SearchResult) => void;
  onRetry: () => void;
  onSortModeChange: (mode: SortMode) => void;
  results: SearchResult[];
  searchError: boolean;
  sortMode: SortMode;
}) {
  const roving = createRovingFocus(
    () => props.results,
    (r) => `${r.channelId}:${r.ts}`,
  );

  return (
    <div
      aria-busy={props.loading}
      class="message-search-results"
      onFocusIn={roving.onContainerFocusIn}
      onFocusOut={roving.onContainerFocusOut}
      ref={roving.setContainerRef}
    >
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
              <div class="message-search-history-header flex-align-center">
                <span class="global-search-filter-label">Recent searches</span>
                <Button
                  class="message-search-history-clear"
                  onClick={() => store.searchHistory.clearSearchHistory()}
                  size="sm"
                  variant="ghost"
                >
                  Clear all
                </Button>
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
                    <IconButton
                      class="message-search-history-remove"
                      icon="close"
                      label="Remove from recent searches"
                      onClick={() => store.searchHistory.removeSearchHistoryEntry(query)}
                      size="sm"
                      tone="dim"
                    />
                  </div>
                )}
              </For>
            </div>
          </Show>
        }
        when={props.canSearch}
      >
        <div class="message-search-toolbar flex-align-center">
          <span class="global-search-filter-label">
            {props.loading
              ? "Searching…"
              : `${props.results.length} ${props.results.length === 1 ? "result" : "results"}`}
          </span>
          <select
            class="message-search-sort-select input-reset"
            onChange={(e) => props.onSortModeChange(e.currentTarget.value as SortMode)}
            value={props.sortMode}
          >
            <For each={SORT_OPTIONS}>{(opt) => <option value={opt.key}>{opt.label}</option>}</For>
          </select>
        </div>
        <Show
          fallback={<div class="global-search-hint empty-state">Searching messages…</div>}
          when={!props.loading || props.results.length > 0}
        >
          <Show
            fallback={
              <div class="message-search-error empty-state">
                <span>Couldn't search messages.</span>
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
                    if (dm)
                      return (
                        <span class="result-message-card-context-text">
                          {dmDisplayName(dm, store.users.userById)}
                        </span>
                      );
                    if (result.channelName?.startsWith("mpdm-")) {
                      store.dms.ensureMpdm(result.channelId);
                      return <span class="result-message-card-context-text">Group message</span>;
                    }
                    const channel = store.channels.channelById(result.channelId);
                    return (
                      <>
                        <Icon name={channelIconName(channel?.private)} size={11} />
                        <span class="result-message-card-context-text">
                          {result.channelName ?? result.channelId}
                        </span>
                      </>
                    );
                  };
                  const ctxMenu = useContextMenu();
                  const isSaved = () => store.later.isSavedForLater(result.channelId, result.ts);
                  const savePending = () =>
                    store.later.laterLoading() ||
                    store.later.isSaveForLaterPending(result.channelId, result.ts);
                  return (
                    <>
                      <ResultMessageCard
                        avatarUser={{
                          avatarColor: user()?.avatarColor ?? DEFAULT_AVATAR_COLOR,
                          avatarUrl: user()?.avatarUrl,
                          id: result.userId,
                          name: user()?.name ?? "Someone",
                        }}
                        context={
                          <ClickableInline onActivate={() => openConversation(result.channelId)}>
                            {channelLabel()}
                          </ClickableInline>
                        }
                        ctxMenu={ctxMenu}
                        name={user()?.name ?? "Someone"}
                        navRow
                        onOpen={() => props.onResult(result)}
                        onSplit={() =>
                          openConversationInSplit(result.channelId, result.threadTs ?? result.ts)
                        }
                        rowKey={`${result.channelId}:${result.ts}`}
                        snippet={<Mrkdwn text={result.text} />}
                        tabIndex={roving.rowProps(`${result.channelId}:${result.ts}`).tabIndex}
                        time={formatTime(result.ts)}
                        timeTitle={`${formatDay(result.ts)} at ${formatTime(result.ts)}`}
                        userId={result.userId}
                      />
                      <ContextMenu
                        onClose={ctxMenu.close}
                        open={ctxMenu.isOpen()}
                        x={ctxMenu.x()}
                        y={ctxMenu.y()}
                      >
                        <MenuItem
                          icon="link"
                          onClick={() => {
                            ctxMenu.close();
                            copyMessageLink(result.channelId, result.ts, result.threadTs);
                          }}
                        >
                          Copy link
                        </MenuItem>
                        <MenuItem
                          icon="move-to-split-view"
                          onClick={() => {
                            ctxMenu.close();
                            openConversationInSplit(result.channelId, result.threadTs ?? result.ts);
                          }}
                        >
                          Open in split view
                        </MenuItem>
                        <MenuItem
                          disabled={savePending()}
                          icon={isSaved() ? "bookmark-filled" : "bookmark"}
                          onClick={() => {
                            ctxMenu.close();
                            store.later.toggleSaveForLater(result.channelId, result.ts);
                          }}
                        >
                          {isSaved() ? "Remove from Later" : "Save for later"}
                        </MenuItem>
                      </ContextMenu>
                    </>
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
