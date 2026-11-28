import { useDebouncer } from "@slock/core/solid";
import { type ListDirection, listNavigationIndex } from "@slock/ui";
import { createEffect, createMemo, createSignal, untrack } from "solid-js";
import {
  resolveRequest,
  SCOPES,
  type SearchInputs,
  type SearchRequest,
  SORT_MODES,
} from "../searchQuery";
import { composeResults } from "./composeResults";
import { directoryReady } from "./localRows";
import { messagePages, removeFromHistory, saveToHistory } from "./queries";
import { type OpenableRow, reuseRows, type SearchRow } from "./rows";
import { createSearchSources, messageArg } from "./sources";

const JUMP_DELAY_MS = 100;
const PAGE_DELAY_MS = 300;
const LOAD_AHEAD = 3;
const MORE_ROW: SearchRow = { id: "more", kind: "more" };
const RETRY_ROW: SearchRow = { id: "retry", kind: "retry" };

interface Snapshot {
  failed: boolean;
  hasMore: boolean;
  key: string;
  rows: SearchRow[];
  scope: SearchRequest["scope"];
  total: number | undefined;
  version: string;
}

interface SearchSessionOptions {
  initial: SearchInputs;
  jumpOnly: boolean;
  onChange?: (inputs: SearchInputs) => void;
  open: (row: OpenableRow, split: boolean) => void;
  writeInput: (query: string) => void;
}

const keyOf = ({ excludeBots, jumpOnly, myChannels, query, scope, sort }: SearchRequest) =>
  JSON.stringify([scope, query, sort, excludeBots, myChannels, jumpOnly]);

function defaultIndex(snapshot: Snapshot | undefined): number | null {
  if (!snapshot?.rows.length || snapshot.scope === "messages") return null;
  return snapshot.rows[0]?.kind === "messages" && snapshot.rows.length > 1 ? 1 : 0;
}

const stepped = <Value>(values: readonly Value[], current: Value, step: 1 | -1) =>
  values[(values.indexOf(current) + step + values.length) % values.length];

export function createSearchSession(options: SearchSessionOptions) {
  let inputs = options.initial;
  let queued: { key: string; split: boolean } | undefined;
  const resolve = () => resolveRequest(inputs, options.jumpOnly);
  const first = resolve();
  const [typed, setTyped] = createSignal(first);
  const [sent, setSent] = createSignal(first);
  const [round, setRound] = createSignal(0);
  const quick = useDebouncer(setSent, JUMP_DELAY_MS);
  const slow = useDebouncer(setSent, PAGE_DELAY_MS);

  function send(request: SearchRequest, now: boolean) {
    quick.cancel();
    slow.cancel();
    if (now || !request.query) return void setSent(request);
    const paged = !["all", "people", "channels"].includes(request.scope);
    (paged ? slow : quick).schedule(request);
  }

  function update(patch: Partial<SearchInputs>, now = true) {
    inputs = { ...inputs, ...patch };
    queued = undefined;
    options.onChange?.(inputs);
    const request = resolve();
    setTyped(request);
    send(request, now);
  }

  const sources = createSearchSources(sent);
  const composition = createMemo(() => composeResults(sent(), sources));
  const settled = createMemo<Snapshot | undefined>(() => {
    const { paged, rows, sources: used } = composition();
    if (!directoryReady() || used.some((source) => source.pending())) return;
    const request = sent();
    const key = keyOf(request);
    const failed = used.some((source) => source.failed());
    const page = paged?.data();
    const list = rows();
    const history = list.flatMap((row) => (row.kind === "history" ? [row.id] : []));
    return {
      failed,
      hasMore: page?.next !== undefined,
      key,
      rows: list,
      scope: request.scope,
      total: page?.total,
      version: JSON.stringify([key, round(), failed, page?.items.length, history, !list.length]),
    };
  });
  const [snapshot, setSnapshot] = createSignal<Snapshot>();
  const shown = createMemo(() => {
    const current = snapshot();
    return current?.scope === typed().scope ? current : undefined;
  });
  const rows = createMemo<SearchRow[]>(() => {
    const current = shown();
    if (!current) return [];
    const footer: SearchRow[] = [];
    if (current.hasMore) footer.push(MORE_ROW);
    if (current.failed) footer.push(RETRY_ROW);
    return [...current.rows, ...footer];
  });
  const shownKey = createMemo(() => shown()?.key);
  const [chosen, setChosen] = createSignal<number | null>(() => {
    shownKey();
    return untrack(() => defaultIndex(shown()));
  });
  const activeIndex = createMemo(() => {
    const index = chosen();
    const count = rows().length;
    return index === null || count === 0 ? null : Math.min(index, count - 1);
  });

  const loadMore = () => composition().paged?.more();
  const retry = () => {
    for (const source of composition().sources) if (source.failed()) source.retry();
  };

  function searchMessagesNow() {
    const request = resolve();
    setRound((current) => current + 1);
    messagePages.invalidate(messageArg(request));
    send(request, true);
    void saveToHistory.run(request.query);
  }

  function activateRow(row: SearchRow, split: boolean) {
    switch (row.kind) {
      case "history":
        options.writeInput(row.entry.text);
        update({ scope: "messages" });
        return searchMessagesNow();
      case "messages":
        void saveToHistory.run(resolve().query);
        return update({ scope: "messages" });
      case "more":
        return loadMore();
      case "retry":
        return retry();
      default: {
        const { query } = resolve();
        if (query && (row.kind === "message" || row.kind === "file")) {
          void saveToHistory.run(query);
        }
        return options.open(row, split);
      }
    }
  }

  function activate(index: number, split: boolean) {
    const row = rows()[index];
    if (row) activateRow(row, split);
  }

  createEffect(settled, (next) => {
    const previous = untrack(snapshot);
    if (!next || next.version === previous?.version) return;
    setSnapshot({ ...next, rows: reuseRows(previous?.rows ?? [], next.rows) });
    if (queued?.key !== next.key) return;
    const { split } = queued;
    queued = undefined;
    const row = next.rows[defaultIndex(next) ?? -1];
    if (row) untrack(() => activateRow(row, split));
  });

  createEffect(
    () => {
      const current = shown();
      const index = activeIndex();
      const { paged } = composition();
      if (!current?.hasMore || index === null || !paged) return false;
      const near = index >= current.rows.length - LOAD_AHEAD;
      return near && !paged.loadingMore() && !paged.moreFailed();
    },
    (wanted) => {
      if (wanted) untrack(loadMore);
    },
  );

  return {
    activate,
    activeIndex,
    busy: () => settled()?.key !== keyOf(typed()),
    cycleScope(step: 1 | -1) {
      const scope = stepped(SCOPES, resolve().scope, step);
      if (scope) update({ scope });
    },
    cycleSort() {
      const sort = stepped(SORT_MODES, resolve().sort, 1);
      if (sort) update({ sort });
    },
    loadingMore: () => !!composition().paged?.loadingMore(),
    loadMore() {
      if (shown()?.hasMore && !composition().paged?.moreFailed()) loadMore();
    },
    move(direction: ListDirection) {
      const next = listNavigationIndex(direction, activeIndex(), rows().length);
      if (next !== undefined) setChosen(next);
    },
    moreFailed: () => !!composition().paged?.moreFailed(),
    open: activateRow,
    removeActiveHistory() {
      const row = rows()[activeIndex() ?? -1];
      if (inputs.query || row?.kind !== "history") return false;
      void removeFromHistory.run(row.entry.hash);
      return true;
    },
    rows,
    select: (index: number) => setChosen(index),
    setQuery(query: string) {
      if (query !== inputs.query) update({ query }, false);
    },
    shown,
    submit(split: boolean) {
      const request = resolve();
      const current = shown()?.key === keyOf(request);
      const index = activeIndex();
      if (current && index !== null) return activate(index, split);
      if (request.scope === "messages") {
        if (request.query) searchMessagesNow();
      } else if (!current) {
        queued = { key: keyOf(request), split };
        send(request, true);
      }
    },
    typed,
    update,
  };
}

export type SearchSession = ReturnType<typeof createSearchSession>;
