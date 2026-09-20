import {
  Button,
  ClickableInline,
  ContextMenu,
  DEFAULT_AVATAR_COLOR,
  findTextRanges,
  Icon,
  IconButton,
  indexElementText,
  initRovingTabIndexDefault,
  isOneOf,
  MenuItem,
  useContextMenu,
} from "@slock/ui";
import { createEffect, For, onCleanup, Show } from "solid-js";
import { formatDay, formatTime, type SearchResult } from "../../lib/api";
import { channelIconName, dmDisplayName } from "../../lib/displayName";
import { copyMessageLink } from "../../lib/messageLinks";
import { openConversation, openConversationInSplit } from "../../lib/navigation/conversationNav";
import type { SortMode } from "../../lib/searchQuery";
import { store } from "../../lib/store";
import MessageReferenceSnippet from "../messages/parts/MessageReferenceSnippet";
import {
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  resolveProfileUserId,
} from "../messages/parts/messageRenderState";
import ResultMessageCard from "../messages/parts/ResultMessageCard";
import { SplitNavigation } from "../navigation/SplitNavigation";
import { SORT_OPTIONS } from "./messageSearchOptions";

const SEARCH_TERM_HIGHLIGHT = "message-search-match";

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
  let containerRef: HTMLDivElement | undefined;
  initRovingTabIndexDefault(
    () => containerRef,
    () => props.results,
  );

  createEffect(() => {
    void props.results;
    const container = containerRef;
    const ranges: Range[] = [];
    if (container) {
      for (const el of container.querySelectorAll<HTMLElement>("[data-search-terms]")) {
        const terms: string[] = JSON.parse(el.dataset.searchTerms ?? "[]");
        if (terms.length === 0) continue;
        const index = indexElementText(el);
        for (const term of terms) ranges.push(...findTextRanges(index, term));
      }
    }
    if (ranges.length > 0) CSS.highlights.set(SEARCH_TERM_HIGHLIGHT, new Highlight(...ranges));
    else CSS.highlights.delete(SEARCH_TERM_HIGHLIGHT);
  });
  onCleanup(() => CSS.highlights.delete(SEARCH_TERM_HIGHLIGHT));

  return (
    <div aria-busy={props.loading} class="message-search-results" ref={containerRef}>
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
            onChange={(e) => {
              const { value } = e.currentTarget;
              const modes = SORT_OPTIONS.map((opt) => opt.key);
              if (isOneOf(value, modes)) props.onSortModeChange(value);
            }}
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
                  const profileUserId = () => resolveProfileUserId(result);
                  const user = () => {
                    const id = profileUserId();
                    return id ? store.users.userById(id) : undefined;
                  };
                  const displayName = () =>
                    resolveAuthorDisplayName(result, user()?.name, "Someone");
                  const avatarUrl = () => resolveAuthorAvatarUrl(result, user()?.avatarUrl);
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
                          avatarUrl: avatarUrl(),
                          id: profileUserId() ?? result.userId,
                          name: displayName(),
                        }}
                        context={
                          <SplitNavigation
                            onSplit={() => openConversationInSplit(result.channelId)}
                          >
                            <ClickableInline onActivate={() => openConversation(result.channelId)}>
                              {channelLabel()}
                            </ClickableInline>
                          </SplitNavigation>
                        }
                        ctxMenu={ctxMenu}
                        name={displayName()}
                        navRow
                        onOpen={() => props.onResult(result)}
                        onSplit={() =>
                          openConversationInSplit(result.channelId, result.threadTs ?? result.ts)
                        }
                        snippet={
                          <span data-search-terms={JSON.stringify(result.highlights ?? [])}>
                            <MessageReferenceSnippet
                              botId={result.botId}
                              botUserId={result.userId}
                              channelId={result.channelId}
                              text={result.text}
                              threadTs={result.threadTs}
                              ts={result.ts}
                            />
                          </span>
                        }
                        tabIndex={-1}
                        time={formatTime(result.ts)}
                        timeTitle={`${formatDay(result.ts)} at ${formatTime(result.ts)}`}
                        userId={profileUserId()}
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
