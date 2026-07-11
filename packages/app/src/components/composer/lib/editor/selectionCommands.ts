import { fragmentToMrkdwn, mrkdwnToFragment, placeCaretAtEnd } from "../richtext";
import type { EditorRefHandle } from "./editorRef";

// Caret/selection plumbing and draft-loading for the composer's
// contentEditable node — the part of editorCommands.ts that doesn't touch
// block formatting or line triggers (see blockCommands.ts for those).
export function createSelectionCommands(
  ref: EditorRefHandle,
  opts: { setText: (v: string) => void; resetLinkPreviews: () => void },
) {
  let savedRange: Range | null = null;

  function syncFromDom() {
    const el = ref.get();
    if (!el) return;
    opts.setText(fragmentToMrkdwn(el));
  }

  function loadDraftIntoEditor(value: string) {
    const el = ref.get();
    if (!el) return;
    el.innerHTML = "";
    el.appendChild(mrkdwnToFragment(value));
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
    if (!sel || !el) return;
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
    syncFromDom,
    loadDraftIntoEditor,
    clearEditor,
    focusEditor,
    saveSelection,
    restoreSelection,
    currentTextContext,
  };
}
