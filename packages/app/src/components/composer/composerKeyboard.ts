import type { EditorCommands } from "./lib/editor/editorCommands";
import { handleMarkShortcut } from "./lib/editor/markShortcuts";
import type { SuggestState } from "./lib/suggestTypes";

export function createComposerKeyHandler(deps: {
  suggest: () => SuggestState | null;
  moveSuggestion: (delta: number) => void;
  applySuggestion: () => void;
  closeSuggestions: () => void;
  editing?: { onCancel: () => void };
  submit: (event: Event) => void;
  editor: EditorCommands;
}) {
  return (e: KeyboardEvent) => {
    const s = deps.suggest();
    if (s && s.items.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        deps.moveSuggestion(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        deps.moveSuggestion(-1);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        deps.applySuggestion();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        deps.closeSuggestions();
        return;
      }
    }
    if (e.key === "Escape" && deps.editing) {
      e.preventDefault();
      deps.editing.onCancel();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      deps.submit(e);
      return;
    }
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      if (!(deps.editor.handleShiftEnterInHeader() || deps.editor.handleShiftEnterInList()))
        deps.editor.insertLineBreak();
      return;
    }
    if (
      e.key === "Backspace" &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      (deps.editor.handleBackspaceOnQuote() ||
        deps.editor.handleBackspaceOnHeading() ||
        deps.editor.handleBackspaceOnDivider())
    ) {
      e.preventDefault();
      return;
    }
    handleMarkShortcut(e, deps.editor);
  };
}
