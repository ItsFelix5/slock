import { indexAlignedText, listNavigationIndex } from "@slock/ui";
import Quill from "quill";
import { store } from "../../../lib/store";
import { type QuerySuggestion, queryToken } from "../querySuggestions";
import {
  FilterPillBlot,
  loadQueryIntoQuill,
  serializeQuery,
  suggestionToPill,
} from "./searchFilterPill";

const USER_TOKEN_RE = /^(from|with):<@([A-Z0-9]+)>$/;
const CHANNEL_TOKEN_RE = /^in:<#([A-Z0-9]+)>$/;

function resolveTokenLabel(token: string): string {
  const userMatch = token.match(USER_TOKEN_RE);
  if (userMatch) {
    const [, modifier, id] = userMatch;
    return `${modifier}:@${store.users.userById(id)?.name ?? id}`;
  }
  const channelMatch = token.match(CHANNEL_TOKEN_RE);
  if (channelMatch) {
    const [, id] = channelMatch;
    return `in:#${store.channels.channelById(id)?.name ?? id}`;
  }
  return token;
}

export interface SearchQueryEditorDeps {
  getSuggestions: () => QuerySuggestion[];
  getActiveSuggestion: () => number | null;
  setActiveSuggestion: (index: number) => void;
  onQueryChange: (query: string, cursor: number, typed: boolean) => void;
  onSubmit: () => void;
  onSuggestionsShouldClose: () => void;
  onEscapeWithNoSuggestions: () => void;
  suggestionsOpen: () => boolean;
}

export function createSearchQueryEditor(deps: SearchQueryEditorDeps) {
  let quill: Quill | undefined;

  function applySuggestion(suggestion: QuerySuggestion) {
    if (!quill) return;
    if (!suggestion.replaceToken) {
      setQueryText(suggestion.value);
      deps.onSubmit();
      return;
    }
    const token = queryToken(indexAlignedText(quill), quill.getSelection()?.index ?? 0);
    quill.deleteText(token.start, token.end - token.start);
    const pill = suggestionToPill(suggestion.value, suggestion.label);
    if (pill) {
      quill.insertEmbed(token.start, "filter", pill.pill);
      quill.insertText(token.start + 1, " ");
      quill.setSelection(token.start + 2, 0);
    } else {
      const text = `${suggestion.value} `;
      quill.insertText(token.start, text);
      quill.setSelection(token.start + text.length, 0);
    }
    deps.onSuggestionsShouldClose();
    deps.onSubmit();
  }

  function setQueryText(text: string) {
    if (!quill) return;
    loadQueryIntoQuill(quill, text, resolveTokenLabel);
    quill.setSelection(quill.getLength() - 1, 0);
  }

  function toggleFilterAt(node: HTMLElement) {
    if (!quill) return;
    const blot = Quill.find(node);
    if (!(blot && "offset" in blot)) return;
    const index = blot.offset(quill.scroll);
    const value = FilterPillBlot.value(node);
    if (!value) return;
    quill.deleteText(index, 1);
    quill.insertEmbed(index, "filter", { ...value, negated: !value.negated });
    quill.setSelection(index + 1, 0);
    deps.onSubmit();
  }

  function alignedText(): string {
    return quill ? indexAlignedText(quill) : "";
  }

  function activeSuggestion(): QuerySuggestion | undefined {
    if (!deps.suggestionsOpen()) return;
    const selected = deps.getActiveSuggestion();
    return selected === null ? undefined : deps.getSuggestions()[selected];
  }

  function submit() {
    deps.onSubmit();
    return false;
  }

  function acceptActiveSuggestion(): boolean {
    const suggestion = activeSuggestion();
    if (!suggestion) return false;
    applySuggestion(suggestion);
    return true;
  }

  function mount(container: HTMLDivElement): Quill {
    quill = new Quill(container, {
      formats: ["filter"],
      modules: {
        clipboard: true,
        history: true,
        keyboard: {
          bindings: {
            submit: { handler: submit, key: "Enter" },
            submitShift: { handler: submit, key: "Enter", shiftKey: true },
            space: { handler: () => !acceptActiveSuggestion(), key: " " },
            tab: {
              handler: () => {
                acceptActiveSuggestion();
                return false;
              },
              key: "Tab",
            },
          },
        },
      },
      placeholder: "Search every message…",
    });
    const q = quill;

    q.on("text-change", (_delta, _old, source) => {
      const cursor = q.getSelection()?.index ?? indexAlignedText(q).length;
      deps.onQueryChange(serializeQuery(q), cursor, source === "user");
    });
    q.on("selection-change", (range) => {
      if (range) deps.onQueryChange(serializeQuery(q), range.index, false);
    });
    q.root.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const pill = target?.closest<HTMLElement>(".search-filter-pill");
      if (pill) toggleFilterAt(pill);
    });
    q.root.addEventListener("keydown", (event) => {
      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && deps.suggestionsOpen()) {
        event.preventDefault();
        const next = listNavigationIndex(
          event.key,
          deps.getActiveSuggestion(),
          deps.getSuggestions().length,
        );
        if (next !== undefined) deps.setActiveSuggestion(next);
      } else if (event.key === "Escape") {
        event.preventDefault();
        if (deps.suggestionsOpen()) deps.onSuggestionsShouldClose();
        else deps.onEscapeWithNoSuggestions();
      }
    });

    return q;
  }

  return { alignedText, applySuggestion, mount, setQueryText, toggleFilterAt };
}
