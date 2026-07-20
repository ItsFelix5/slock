import type { InlineDialect } from "../richtext";
import { createBlockCommands } from "./blockCommands";
import { createEditorRef } from "./editorRef";
import { createLinkifyCommands } from "./linkifyCommands";
import { createSelectionCommands } from "./selectionCommands";

// Owns the contentEditable DOM node and all direct manipulation of it. Split
// across editorRef.ts (the shared DOM handle), selectionCommands.ts (caret/
// selection plumbing), and blockCommands.ts (inline marks, block formatting,
// line triggers) to stay under the file-size cap — this file just wires the
// three together into the single `editor` object Composer.tsx (and, with the
// markdown dialect, CanvasPanel.tsx) uses.
export function createEditorCommands(opts: {
  setText: (v: string) => void;
  resetLinkPreviews: () => void;
  closeSuggestions: () => void;
  dialect?: InlineDialect;
}) {
  const ref = createEditorRef();
  const selection = createSelectionCommands(ref, {
    dialect: opts.dialect,
    resetLinkPreviews: opts.resetLinkPreviews,
    setText: opts.setText,
  });
  const block = createBlockCommands(ref, {
    closeSuggestions: opts.closeSuggestions,
    currentTextContext: selection.currentTextContext,
    focusEditor: selection.focusEditor,
    syncFromDom: selection.syncFromDom,
  });
  const linkify = createLinkifyCommands(ref, {
    currentTextContext: selection.currentTextContext,
    syncFromDom: selection.syncFromDom,
  });

  return {
    getRef: ref.get,
    setRef: ref.set,
    ...selection,
    ...block,
    ...linkify,
  };
}

export type EditorCommands = ReturnType<typeof createEditorCommands>;
