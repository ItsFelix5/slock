import { fragmentToMrkdwn, type InlineDialect, MRKDWN_DIALECT } from "@slock/blockkit";
import {
  htmlToFragment,
  mrkdwnToFragment,
  pasteTextToFragment,
  placeCaretAtEnd,
  placeCaretInText,
} from "../richtext";
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
    allowBlockKit?: boolean;
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
    el.appendChild(mrkdwnToFragment(value, dialect, { allowBlockKit: opts.allowBlockKit ?? true }));
  }

  function insertPastedTextAtCaret(text: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const frag = pasteTextToFragment(text);
    const caretAnchor = document.createTextNode("");
    frag.appendChild(caretAnchor);
    range.insertNode(frag);
    placeCaretInText(caretAnchor, 0);
    syncFromDom();
  }

  // Canvas content comes back as a real HTML document rather than the
  // markdown source loadDraftIntoEditor expects — see htmlToFragment.
  function loadHtmlIntoEditor(html: string) {
    const el = ref.get();
    if (!el) return;
    el.innerHTML = "";
    el.appendChild(htmlToFragment(html));
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

  // The default browser copy of a contentEditable selection reduces chips
  // (mention/channel/date/link/emoji, all rendered as `contenteditable=false`
  // spans carrying the real id in a data attribute) down to their visible
  // text, so pasting "@lisa" back doesn't reconstruct a mention — it's just
  // the literal characters. Serializing through the same mrkdwn/token
  // pipeline used for submission means the special tokens survive (and
  // insertPastedTextAtCaret already turns `<@id>` etc. back into chips on
  // paste); plain formatting marks come back as literal `*`/`` ` `` too,
  // which is what every markdown-aware editor does for plain-text copies.
  function copySelection(e: ClipboardEvent): boolean {
    const el = ref.get();
    const sel = window.getSelection();
    if (!(el && sel) || sel.rangeCount === 0 || sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return false;
    const container = document.createElement("div");
    container.appendChild(range.cloneContents());
    const text = fragmentToMrkdwn(container, dialect);
    if (!(text && e.clipboardData)) return false;
    e.clipboardData.setData("text/plain", text);
    e.preventDefault();
    return true;
  }

  function cutSelection(e: ClipboardEvent): boolean {
    if (!copySelection(e)) return false;
    const sel = window.getSelection();
    sel?.getRangeAt(0).deleteContents();
    syncFromDom();
    return true;
  }

  return {
    clearEditor,
    copySelection,
    currentTextContext,
    cutSelection,
    focusEditor,
    insertPastedTextAtCaret,
    loadDraftIntoEditor,
    loadHtmlIntoEditor,
    restoreSelection,
    saveSelection,
    syncFromDom,
  };
}
