import { inside, scrollActiveListOption, useShortcut } from "@slock/ui";
import { Show, untrack } from "solid-js";
import { createSearchSession } from "../engine/session";
import type { SearchInputs } from "../searchQuery";
import FilterMenu from "./FilterMenu";
import { openRow } from "./openRow";
import ScopeBar from "./ScopeBar";
import SearchList from "./SearchList";
import SearchQueryInput, { type SearchQueryInputHandle } from "./SearchQueryInput";
import "./Search.css";

export default function SearchSurface(props: {
  expand?: (inputs: SearchInputs) => void;
  initial: SearchInputs;
  jumpOnly?: boolean;
  onChange?: (inputs: SearchInputs) => void;
  onEscape?: () => void;
  onOpened?: () => void;
}) {
  let input: SearchQueryInputHandle | undefined;
  let list: HTMLDivElement | undefined;
  let root: HTMLDivElement | undefined;

  const initial = untrack(() => props.initial);
  const jumpOnly = untrack(() => !!props.jumpOnly);
  const session = createSearchSession({
    initial,
    jumpOnly,
    onChange: (inputs) => props.onChange?.(inputs),
    open: async (row, split) => {
      if (await openRow(row, split)) props.onOpened?.();
    },
    writeInput: (query) => input?.setQuery(query),
  });

  const target = inside(() => root);
  const openResultMenu = () => {
    const row = list?.querySelector<HTMLElement>(".active .result-message-card-main");
    if (!row) return;
    const { left, top } = row.getBoundingClientRect();
    row.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, clientX: left, clientY: top }),
    );
  };
  useShortcut({
    combo: { key: "F10", shift: true },
    group: "Lists",
    handler: openResultMenu,
    id: "search.resultMenu",
    label: "Search result menu",
    scope: "lists",
    target,
  });
  useShortcut({
    combo: { key: "ContextMenu" },
    group: "Lists",
    handler: openResultMenu,
    id: "search.resultMenuKey",
    label: "Search result menu",
    scope: "lists",
    target,
  });
  useShortcut({
    allowInInputs: true,
    combo: { key: "g", mod: true },
    enabled: () => !!props.expand,
    group: "App",
    handler: () => props.expand?.(session.typed()),
    id: "search.expand",
    label: "Open search in full view",
    scope: "general",
    target,
  });

  return (
    <div class="search-surface flex-col" ref={root}>
      <div class="search-header flex-align-center">
        <SearchQueryInput
          handle={(handle) => {
            input = handle;
          }}
          initial={initial.query}
          list={{
            enabled: () => session.rows().length > 0,
            move: (direction) => {
              session.move(direction);
              scrollActiveListOption(() => list);
            },
          }}
          onEscape={props.onEscape}
          onQuery={session.setQuery}
          onRemove={session.removeActiveHistory}
          onSubmit={session.submit}
          placeholder="Search Slack"
        />
        <Show when={!jumpOnly}>
          <FilterMenu input={() => input} session={session} />
        </Show>
      </div>
      <Show when={!jumpOnly}>
        <ScopeBar session={session} target={target} />
      </Show>
      <SearchList
        ref={(el) => {
          list = el;
        }}
        session={session}
        target={target}
      />
    </div>
  );
}
