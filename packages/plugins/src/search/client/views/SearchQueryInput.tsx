import { service } from "@slock/core/solid";
import { createListboxActiveIndex, FloatingPanel, Icon, SuggestionList } from "@slock/ui";
import { createMemo, createSignal, createUniqueId, onSettled } from "solid-js";
import { fetchBrowsableChannels } from "../../../slack/client/api";
import { createSearchQueryEditor } from "./lib/searchQueryEditor";
import { createTokenEntitySearch, mergeById } from "./lib/tokenEntitySearch";
import {
  activeViewSuggestionContext,
  type QuerySuggestion,
  querySuggestions,
  renderQuerySuggestion,
} from "./querySuggestions";
import "./SearchQueryInput.css";

const bootstrapStore = service("bootstrap");
const usersStore = service("users");

export interface SearchQueryInputHandle {
  focus: () => void;
  setQuery: (text: string) => void;
}

export default function SearchQueryInput(props: {
  handle?: (handle: SearchQueryInputHandle) => void;
  initial?: string;
  modifiers?: readonly string[];
  onEscape?: () => void;
  onQuery: (query: string) => void;
  onSubmit: () => void;
  placeholder: string;
}) {
  let containerEl: HTMLDivElement | undefined;
  let suggestionsListRef: HTMLDivElement | undefined;

  const [serializedQuery, setSerializedQuery] = createSignal("");
  const [cursor, setCursor] = createSignal(0);
  const [dismissedSuggestionsFor, setDismissedSuggestionsFor] = createSignal<string>();
  const suggestionListId = createUniqueId();

  const editor = createSearchQueryEditor({
    getActiveSuggestion: () => activeSuggestion(),
    getSuggestions: () => suggestions(),
    onEscapeWithNoSuggestions: () => props.onEscape?.(),
    onQueryChange: (query, nextCursor, typed) => {
      setSerializedQuery(query);
      setCursor(nextCursor);
      props.onQuery(query);
      if (typed) setDismissedSuggestionsFor(undefined);
    },
    onSubmit: () => {
      setDismissedSuggestionsFor(serializedQuery());
      props.onSubmit();
    },
    onSuggestionsShouldClose: () => setDismissedSuggestionsFor(serializedQuery()),
    placeholder: props.placeholder,
    setActiveSuggestion: (index) => setActiveSuggestion(index),
    suggestionsOpen: () => suggestionsOpen(),
  });

  const { remoteUsers, remoteChannels } = createTokenEntitySearch({
    cursor,
    query: () => editor.alignedText(),
    searchChannels: fetchBrowsableChannels,
    searchUsers: (term) => usersStore.searchUsers(term),
  });
  const suggestions = createMemo<QuerySuggestion[]>(() =>
    querySuggestions(
      editor.alignedText(),
      cursor(),
      mergeById(usersStore.knownUsers(), remoteUsers()),
      mergeById(bootstrapStore.bootstrap.data?.channels ?? [], remoteChannels()),
      { ...activeViewSuggestionContext(), modifiers: props.modifiers },
    ).slice(0, 8),
  );
  const suggestionsOpen = createMemo(
    () => suggestions().length > 0 && dismissedSuggestionsFor() !== serializedQuery(),
  );
  const { activeIndex: activeSuggestion, setActiveIndex: setActiveSuggestion } =
    createListboxActiveIndex(
      () => suggestions().length,
      suggestionListId,
      () => suggestionsListRef,
    );

  onSettled(() => {
    if (!containerEl) return;
    const quill = editor.mount(containerEl);
    quill.focus();
    editor.setQueryText(props.initial ?? "");
    props.handle?.({ focus: () => quill.focus(), setQuery: editor.setQueryText });
  });

  return (
    <div class="search-query flex-align-center">
      <Icon class="search-query-icon flex-shrink-0 text-dim" name="search" size={16} />
      <div class="ql-editor-root search-query-editor grow" ref={containerEl} />
      <FloatingPanel anchor={() => containerEl} open={suggestionsOpen()}>
        <SuggestionList
          activeIndex={activeSuggestion()}
          class="menu-panel search-query-suggestions"
          id={suggestionListId}
          itemId={(index) => `${suggestionListId}-option-${index}`}
          items={suggestions()}
          onHover={setActiveSuggestion}
          onPick={(index) => {
            const suggestion = suggestions()[index];
            if (suggestion) editor.applySuggestion(suggestion);
          }}
          ref={(el) => {
            suggestionsListRef = el;
          }}
          renderItem={renderQuerySuggestion}
        />
      </FloatingPanel>
    </div>
  );
}
