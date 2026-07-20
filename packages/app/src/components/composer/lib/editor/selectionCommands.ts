import { type InlineDialect, MRKDWN_DIALECT, mrkdwnToFragment, placeCaretAtEnd } from "../richtext";
import { fragmentToMrkdwn } from "../richtextSerialization";
import type { EditorRefHandle } from "./editorRef";

// Caret/selection plumbing and draft-loading for the composer's
// contentEditable node — the part of editorCommands.ts that doesn't touch
// block formatting or line triggers (see blockCommands.ts for those). Also
// reused by the canvas editor with the markdown dialect instead of mrkdwn
// (see richtext.ts's InlineDialect) — everything below is otherwise
// text-syntax-agnostic.
export function createSelectionCommands(
  ref: EditorRefHandle,
  opts: {
    setText: (v: string) => void;
    resetLinkPreviews: () => void;
    dialect?: InlineDialect;
  },
) {
  let savedRange: Range | null = null;
  const dialect = opts.dialect ?? MRKDWN_DIALECT;

  function syncFromDom() {
    const el = ref.get();
    if (!el) return;
    opts.setText(fragmentToMrkdwn(el, dialect));
  }

  function loadDraftIntoEditor(value: string) {
    const el = ref.get();
    if (!el) return;
    el.innerHTML = "";
    el.appendChild(mrkdwnToFragment(value, dialect));
  }

  function clearEditor() {
    opts.setText("");
    const el = ref.get();
    if (el) el.innerHTML = "";
    opts.resetLinkPreviews();
  }

  function focusEditor() {
    ref.get()?.focus();
  }

  // The emoji/mention pickers render their own autofocused search inputs,
  // which steals focus (and with it, window.getSelection()) away from the
  // editor the instant they open. We snapshot the caret before that happens
  // and restore it right before inserting, so "insert emoji" lands where the
  // user was actually typing instead of wherever focus last was.
  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.get()?.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    } else {
      savedRange = null;
    }
  }

  function restoreSelection() {
    focusEditor();
    const sel = window.getSelection();
    const el = ref.get();
    if (!(sel && el)) return;
    sel.removeAllRanges();
    if (savedRange) sel.addRange(savedRange);
    else placeCaretAtEnd(el);
  }

  function currentTextContext(): { node: Text; offset: number } | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    if (!ref.get()?.contains(node)) return null;
    return { node: node as Text, offset: sel.anchorOffset };
  }

  return {
    clearEditor,
    currentTextContext,
    focusEditor,
    loadDraftIntoEditor,
    restoreSelection,
    saveSelection,
    syncFromDom,
  };
}
