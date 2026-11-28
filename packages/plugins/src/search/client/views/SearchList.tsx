import {
  ariaBoolean,
  findTextRanges,
  indexElementText,
  isNearScrollEnd,
  isOneOf,
  paintHighlight,
  useShortcut,
} from "@slock/ui";
import { createEffect, For, Show } from "solid-js";
import type { SearchSession } from "../engine/session";
import { SORT_MODES, type SortMode } from "../searchQuery";
import ResultRow from "./rows/ResultRow";

const HIGHLIGHT = "search-match";
const LOAD_MARGIN_PX = 200;

const SORT_LABELS: Record<SortMode, string> = {
  newest: "Newest",
  oldest: "Oldest",
  relevant: "Most relevant",
};

function highlightTerms(root: HTMLElement) {
  const ranges: Range[] = [];
  for (const element of root.querySelectorAll<HTMLElement>("[data-search-terms]")) {
    const terms: string[] = JSON.parse(element.dataset.searchTerms ?? "[]");
    if (terms.length === 0) continue;
    const index = indexElementText(element);
    for (const term of terms) ranges.push(...findTextRanges(index, term));
  }
  return paintHighlight(HIGHLIGHT, ranges);
}

export default function SearchList(props: {
  ref: (element: HTMLDivElement) => void;
  session: SearchSession;
  target: (element: Element) => boolean;
}) {
  let list: HTMLDivElement | undefined;
  const request = () => props.session.typed();
  const sortable = () =>
    !!request().query && ["messages", "files", "canvases", "lists"].includes(request().scope);
  const history = () => request().scope === "messages" && !request().query;
  const status = () => {
    if (props.session.rows().length > 0 || !request().query) return "";
    return props.session.busy() ? "Searching…" : "No matches.";
  };
  const count = () => {
    if (props.session.busy()) return "Searching…";
    const total = props.session.shown()?.total;
    if (total === undefined) return "";
    return `${total.toLocaleString()} ${total === 1 ? "result" : "results"}`;
  };

  useShortcut({
    allowInInputs: true,
    combo: { key: "o", mod: true, shift: true },
    enabled: sortable,
    group: "Lists",
    handler: () => props.session.cycleSort(),
    id: "search.cycleSort",
    label: "Change search sort order",
    scope: "lists",
    target: (element) => props.target(element),
  });

  createEffect(
    () => props.session.shown()?.key,
    () => {
      if (list) list.scrollTop = 0;
    },
  );
  createEffect(
    () => props.session.rows(),
    () => {
      if (!list) return;
      return highlightTerms(list);
    },
  );

  return (
    <>
      <Show when={history() && props.session.rows().length > 0}>
        <div class="search-toolbar flex-align-center">
          <span class="search-label">Recent searches</span>
        </div>
      </Show>
      <Show when={sortable()}>
        <div class="search-toolbar flex-align-center">
          <span class="search-label">{count()}</span>
          <select
            class="search-sort input-reset"
            onChange={(event) => {
              const { value } = event.currentTarget;
              if (isOneOf(value, SORT_MODES)) props.session.update({ sort: value });
            }}
            value={request().sort}
          >
            <For each={SORT_MODES}>
              {(mode) => <option value={mode}>{SORT_LABELS[mode]}</option>}
            </For>
          </select>
        </div>
      </Show>
      <div
        aria-busy={ariaBoolean(props.session.busy())}
        class="search-results grow"
        onScroll={(event) => {
          if (isNearScrollEnd(event.currentTarget, LOAD_MARGIN_PX)) props.session.loadMore();
        }}
        ref={(element) => {
          list = element;
          props.ref(element);
        }}
      >
        <For each={props.session.rows()}>
          {(row, index) => <ResultRow index={index()} row={row} session={props.session} />}
        </For>
        <Show when={status()}>
          <div class="search-status empty-state">{status()}</div>
        </Show>
      </div>
    </>
  );
}
