import {
  type ListDirection,
  listNavigationIndex,
  useEditShortcuts,
  useListShortcuts,
} from "@slock/ui";
import Quill from "@slock/ui/editor/quill";
import { indexAlignedText } from "@slock/ui/editor/quillText";
import type { QuerySuggestion } from "../querySuggestions";
import { tokenAt } from "./queryToken";
import { loadQueryIntoQuill, pillOf, serializeQuery, wholeTokenPill } from "./searchFilterPill";

const NEGATION_RE = /^-/;

interface QueryChange {
  aligned: string;
  cursor: number;
  query: string;
  typed: boolean;
}

export interface SearchQueryEditorDeps {
  canEscape: () => boolean;
  getActiveSuggestion: () => number | null;
  getSuggestions: () => QuerySuggestion[];
  list: { enabled: () => boolean; move: (direction: ListDirection) => void };
  onEscape: () => void;
  onQueryChange: (change: QueryChange) => void;
  onRemove: () => boolean;
  onSubmit: (split: boolean) => void;
  onSuggestionsShouldClose: () => void;
  placeholder: string;
  setActiveSuggestion: (index: number) => void;
  suggestionsOpen: () => boolean;
}

export function createSearchQueryEditor(deps: SearchQueryEditorDeps) {
  let quill: Quill | undefined;
  const root = () => quill?.root;

  useListShortcuts({
    edges: false,
    enabled: deps.suggestionsOpen,
    move: (direction) => {
      const next = listNavigationIndex(
        direction,
        deps.getActiveSuggestion(),
        deps.getSuggestions().length,
      );
      if (next !== undefined) deps.setActiveSuggestion(next);
    },
    root,
  });
  useListShortcuts({
    edges: false,
    enabled: () => !deps.suggestionsOpen() && deps.list.enabled(),
    move: deps.list.move,
    root,
  });
  useEditShortcuts({
    cancel: () => {
      if (deps.suggestionsOpen()) deps.onSuggestionsShouldClose();
      else deps.onEscape();
    },
    enabled: () => deps.suggestionsOpen() || deps.canEscape(),
    root,
  });

  function replaceWithPill(start: number, length: number, value: string, label?: string) {
    const pill = wholeTokenPill(value);
    if (!(quill && pill)) return;
    quill.deleteText(start, length);
    quill.insertEmbed(start, "filter", label ? { ...pill, label } : pill);
    return start + 1;
  }

  function applySuggestion({ label, value }: QuerySuggestion) {
    if (!quill) return;
    const cursor = quill.getSelection(true).index;
    const { end, start } = tokenAt(indexAlignedText(quill), cursor);
    const after = replaceWithPill(start, end - start, value, label.replace(NEGATION_RE, ""));
    if (after === undefined) return;
    quill.insertText(after, " ");
    quill.setSelection(after + 1, 0);
  }

  function pillifyTokenBeforeCursor() {
    const cursor = quill?.getSelection()?.index;
    if (!quill || cursor === undefined) return;
    const text = indexAlignedText(quill);
    if (text[cursor - 1] !== " ") return;
    const { start, value } = tokenAt(text, cursor - 1);
    if (replaceWithPill(start, value.length, value) !== undefined) {
      quill.setSelection(start + 2, "silent");
    }
  }

  function editPillBefore(index: number): boolean {
    if (!quill || index === 0) return false;
    const pill = pillOf(quill.getContents(index - 1, 1).ops[0]?.insert);
    if (!pill) return false;
    const [modifier] = pill.token.split(":");
    const text = `${pill.negated ? "-" : ""}${modifier}:`;
    quill.deleteText(index - 1, 1, "user");
    quill.insertText(index - 1, text, "user");
    quill.setSelection(index - 1 + text.length, 0);
    return true;
  }

  function acceptActiveSuggestion(): boolean {
    if (!deps.suggestionsOpen()) return false;
    const selected = deps.getActiveSuggestion();
    const suggestion = selected === null ? undefined : deps.getSuggestions()[selected];
    if (!suggestion) return false;
    applySuggestion(suggestion);
    return true;
  }

  function submit(split: boolean) {
    if (!acceptActiveSuggestion()) {
      deps.onSuggestionsShouldClose();
      deps.onSubmit(split);
    }
    return false;
  }

  function setQueryText(text: string) {
    if (!quill) return;
    loadQueryIntoQuill(quill, text);
    quill.setSelection(quill.getLength() - 1, 0);
  }

  function insert(text: string) {
    if (!quill) return;
    const { index } = quill.getSelection(true);
    const before = indexAlignedText(quill).charAt(index - 1);
    const added = before.trim() && before !== "\uFFFC" ? ` ${text}` : text;
    quill.insertText(index, added, "user");
    quill.setSelection(index + added.length, 0);
  }

  function mount(container: HTMLDivElement): Quill {
    const q = new Quill(container, {
      formats: ["filter"],
      modules: {
        clipboard: true,
        history: true,
        keyboard: {
          bindings: {
            remove: { handler: () => !deps.onRemove(), key: "Delete" },
            submit: { handler: () => submit(false), key: "Enter" },
            submitSplit: { handler: () => submit(true), key: "Enter", shiftKey: true },
            tab: { handler: () => !acceptActiveSuggestion(), key: "Tab" },
            unpill: {
              collapsed: true,
              handler: ({ index }: { index: number }) => !editPillBefore(index),
              key: "Backspace",
            },
          },
        },
      },
      placeholder: deps.placeholder,
    });
    quill = q;

    const report = (cursor: number, typed: boolean) => {
      const aligned = indexAlignedText(q);
      deps.onQueryChange({ aligned, cursor, query: serializeQuery(q), typed });
    };
    q.on("text-change", (_delta, _old, source) => {
      if (source === "user") pillifyTokenBeforeCursor();
      report(q.getSelection()?.index ?? q.getLength() - 1, source === "user");
    });
    q.on("selection-change", (range) => {
      if (range) report(range.index, false);
      else deps.onSuggestionsShouldClose();
    });
    q.root.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const node = target?.closest<HTMLElement>(".search-filter-pill");
      const blot = node ? Quill.find(node) : null;
      if (blot && "offset" in blot) editPillBefore(blot.offset(q.scroll) + 1);
    });
    q.root.addEventListener(
      "paste",
      (event) => {
        const text = event.clipboardData?.getData("text/plain");
        if (text === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        const range = q.getSelection(true);
        const flat = text.replace(/\r\n|\r|\n/g, " ");
        q.deleteText(range.index, range.length, "user");
        q.insertText(range.index, flat, "user");
        q.setSelection(range.index + flat.length, 0);
      },
      true,
    );
    return q;
  }

  return { applySuggestion, insert, mount, setQueryText };
}
