import { service } from "@slock/core/solid";
import { createListboxActiveIndex, FloatingPanel, Icon, SuggestionList } from "@slock/ui";
import { createMemo, createSignal, createUniqueId, onSettled, untrack } from "solid-js";
import { createSearchQueryEditor, type SearchQueryEditorDeps } from "./lib/searchQueryEditor";
import { createTokenEntitySearch, mergeById } from "./lib/tokenEntitySearch";
import {
  activeViewSuggestionContext,
  type QuerySuggestion,
  querySuggestions,
  renderQuerySuggestion,
} from "./querySuggestions";
import "./SearchQueryInput.css";

const channelsStore = service("channels");
const usersStore = service("users");

const SUGGESTION_LIMIT = 8;

export interface SearchQueryInputHandle {
  focus: () => void;
  insert: (text: string) => void;
  setQuery: (text: string) => void;
}

export default function SearchQueryInput(props: {
  handle?: (handle: SearchQueryInputHandle) => void;
  initial?: string;
  list?: SearchQueryEditorDeps["list"];
  modifiers?: readonly string[];
  onEscape?: () => void;
  onQuery: (query: string) => void;
  onRemove?: () => boolean;
  onSubmit: (split: boolean) => void;
  placeholder: string;
}) {
  let containerEl: HTMLDivElement | undefined;
  let suggestionsListRef: HTMLDivElement | undefined;

  const [text, setText] = createSignal({ aligned: "", cursor: 0 });
  const [dismissed, setDismissed] = createSignal(false);
  const suggestionListId = createUniqueId();

  const editor = createSearchQueryEditor({
    canEscape: () => !!props.onEscape,
    getActiveSuggestion: () => activeSuggestion(),
    getSuggestions: () => suggestions(),
    list: {
      enabled: () => !!props.list?.enabled(),
      move: (direction) => props.list?.move(direction),
    },
    onEscape: () => props.onEscape?.(),
    onQueryChange: ({ aligned, cursor, query, typed }) => {
      setText({ aligned, cursor });
      props.onQuery(query);
      if (!typed) return;
      setDismissed(false);
      setActiveSuggestion(0);
    },
    onRemove: () => !!props.onRemove?.(),
    onSubmit: (split) => props.onSubmit(split),
    onSuggestionsShouldClose: () => setDismissed(true),
    placeholder: untrack(() => props.placeholder),
    setActiveSuggestion: (index) => setActiveSuggestion(index),
    suggestionsOpen: () => suggestionsOpen(),
  });

  const { remoteUsers, remoteChannels } = createTokenEntitySearch({
    cursor: () => text().cursor,
    text: () => text().aligned,
  });
  const suggestions = createMemo<QuerySuggestion[]>(() =>
    querySuggestions(
      text().aligned,
      text().cursor,
      mergeById(usersStore.knownUsers(), remoteUsers()),
      mergeById<{ id: string; name: string }>(channelsStore.channels(), remoteChannels()),
      { ...activeViewSuggestionContext(), modifiers: props.modifiers },
    ).slice(0, SUGGESTION_LIMIT),
  );
  const suggestionsOpen = createMemo(() => suggestions().length > 0 && !dismissed());
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
    untrack(() => {
      editor.setQueryText(props.initial ?? "");
      props.handle?.({
        focus: () => quill.focus(),
        insert: editor.insert,
        setQuery: editor.setQueryText,
      });
    });
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
