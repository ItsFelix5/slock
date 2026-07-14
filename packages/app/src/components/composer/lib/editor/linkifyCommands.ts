// biome-ignore-all lint/performance/useTopLevelRegex: The expression is local to link parsing.
import { createLinkSpan } from "../linkChip";
import { placeCaretInText } from "../richtext";
import type { EditorRefHandle } from "./editorRef";

// Converts a bare URL into a createLinkSpan (see linkChip.ts) the moment it's
// "finished" — i.e. followed by whitespace, the same signal Slack's own
// composer uses. maybeLinkifyTypedUrl only looks at the text node the caret
// is currently in (cheap enough to call on every keystroke); linkifyAll
// sweeps the whole editor and also catches a URL sitting at the very end of
// the message with no trailing space yet (e.g. Enter pressed right after
// it) — used on paste and right before send.
const TYPED_URL_RE = /https?:\/\/[^\s<>]+(?=\s)/g;
const FINAL_URL_RE = /https?:\/\/[^\s<>]+/g;

function shouldSkip(node: Text): boolean {
  return !!node.parentElement?.closest("code, pre, .composer-link, .composer-link-chip");
}

function linkifyTextNode(node: Text, caretOffset: number | null, re: RegExp): boolean {
  if (shouldSkip(node)) return false;
  const text = node.textContent ?? "";
  const frag = document.createDocumentFragment();
  let last = 0;
  let changed = false;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    const raw = m[0];
    const clean = raw.replace(/[),.!?;:'"]+$/, "");
    if (!clean) continue;
    if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
    frag.appendChild(createLinkSpan(clean));
    const trailing = raw.slice(clean.length);
    if (trailing) frag.appendChild(document.createTextNode(trailing));
    last = idx + raw.length;
    changed = true;
  }
  if (!changed) return false;
  const rest = document.createTextNode(text.slice(last));
  frag.appendChild(rest);
  node.replaceWith(frag);
  if (caretOffset !== null && caretOffset >= last) placeCaretInText(rest, caretOffset - last);
  return true;
}

export function createLinkifyCommands(
  ref: EditorRefHandle,
  opts: {
    currentTextContext: () => { node: Text; offset: number } | null;
    syncFromDom: () => void;
  },
) {
  function maybeLinkifyTypedUrl(): boolean {
    const ctx = opts.currentTextContext();
    const el = ref.get();
    if (!(ctx && el?.contains(ctx.node))) return false;
    const changed = linkifyTextNode(ctx.node, ctx.offset, TYPED_URL_RE);
    if (changed) opts.syncFromDom();
    return changed;
  }

  function linkifyAll(): void {
    const el = ref.get();
    if (!el) return;
    const sel = window.getSelection();
    const range = sel && sel.rangeCount > 0 && sel.isCollapsed ? sel.getRangeAt(0) : null;
    const caretNode = range?.startContainer;
    const caretOffset = range?.startOffset ?? 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
    let changed = false;
    for (const node of nodes) {
      if (linkifyTextNode(node, node === caretNode ? caretOffset : null, FINAL_URL_RE))
        changed = true;
    }
    if (changed) opts.syncFromDom();
  }

  return { linkifyAll, maybeLinkifyTypedUrl };
}
