import { HEADING_TAG_RE } from "@slock/blockkit";
import {
  closestListItem,
  createComposerBlockSeparator,
  placeCaretAtEnd,
  placeCaretAtStart,
  placeCaretInText,
} from "../richtext";
import type { EditorRefHandle } from "./editorRef";

const BLOCK_NAMES = new Set(["BLOCKQUOTE", "PRE", "HR", "UL", "OL"]);

function isBlockEl(n: Node | null): boolean {
  return (
    !!n &&
    n.nodeType === Node.ELEMENT_NODE &&
    (BLOCK_NAMES.has(n.nodeName) || HEADING_TAG_RE.test(n.nodeName))
  );
}
function isSeparator(n: Node | null): n is HTMLElement {
  return (
    !!n &&
    n.nodeType === Node.ELEMENT_NODE &&
    (n as HTMLElement).classList.contains("composer-block-separator")
  );
}
// a hidden block separator renders nothing on its own, it only looks like a
// line break because the block next to it forces one. once a neighbouring
// block is unwrapped into plain text a separator stranded between two plain
// runs would collapse them onto one line while still serializing a newline,
// so it has to become a real visible br
function normalizeSeparator(sep: Node | null) {
  if (isSeparator(sep) && !isBlockEl(sep.previousSibling) && !isBlockEl(sep.nextSibling)) {
    sep.classList.remove("composer-block-separator");
  }
}
// index of the top-level child of `block` the caret sits in (or -1 if the
// caret isn't inside it)
function topChildOffset(block: HTMLElement, startContainer: Node, startOffset: number): number {
  if (startContainer === block) return startOffset;
  let top = startContainer;
  while (top.parentNode && top.parentNode !== block) top = top.parentNode;
  return Array.prototype.indexOf.call(block.childNodes, top);
}
// split a block's children into lines at each top-level br. a lone trailing
// br is the current line's filler, not an extra empty line, the same rule the
// serializer uses when it strips one trailing newline
function blockLines(block: HTMLElement): Node[][] {
  const kids = Array.from(block.childNodes);
  if (kids.length > 1 && kids[kids.length - 1].nodeName === "BR") kids.pop();
  const lines: Node[][] = [[]];
  for (const kid of kids) {
    if (kid.nodeName === "BR") lines.push([]);
    else lines[lines.length - 1].push(kid);
  }
  return lines;
}

export function createNavigationCommands(ref: EditorRefHandle, syncFromDom: () => void) {
  // the caret must sit at the very start of its line inside `block`, nothing
  // but ignorable empty text between the preceding line break and the caret
  function caretAtLineStart(block: HTMLElement): boolean {
    const sel = window.getSelection();
    if (!sel?.isCollapsed || sel.rangeCount === 0) return false;
    const { startContainer, startOffset } = sel.getRangeAt(0);
    const childOffset = topChildOffset(block, startContainer, startOffset);
    if (childOffset < 0) return false;
    let prevBreak = -1;
    for (let i = 0; i < childOffset; i++) {
      if (block.childNodes[i].nodeName === "BR") prevBreak = i;
    }
    const before = document.createRange();
    before.setStart(block, prevBreak + 1);
    before.setEnd(startContainer, startOffset);
    const frag = before.cloneContents();
    return (frag.textContent ?? "").replace(/​/g, "").length === 0 && !frag.querySelector("img");
  }
  function caretLineIndex(block: HTMLElement, lineCount: number): number {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    const { startContainer, startOffset } = sel.getRangeAt(0);
    const childOffset = Math.max(0, topChildOffset(block, startContainer, startOffset));
    let breaks = 0;
    for (let i = 0; i < childOffset; i++) {
      if (block.childNodes[i].nodeName === "BR") breaks++;
    }
    return Math.min(breaks, lineCount - 1);
  }
  function closestBlock(match: (name: string) => boolean): HTMLElement | null {
    const el = ref.get();
    const sel = window.getSelection();
    if (!(el && sel?.isCollapsed) || sel.rangeCount === 0) return null;
    let n: Node | null = sel.getRangeAt(0).startContainer;
    while (n && n !== el && !match(n.nodeName)) n = n.parentNode;
    return n && n !== el ? (n as HTMLElement) : null;
  }
  function buildQuote(lines: Node[][]): HTMLElement {
    const bq = document.createElement("blockquote");
    bq.className = "composer-quote";
    lines.forEach((line, i) => {
      if (i > 0) bq.appendChild(document.createElement("br"));
      for (const node of line) bq.appendChild(node);
    });
    if (!bq.childNodes.length) bq.appendChild(document.createElement("br"));
    return bq;
  }

  function caretAfter(node: Node) {
    const sel = window.getSelection();
    if (!sel) return;
    const r = document.createRange();
    r.setStartAfter(node);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }
  // backspace at the start of a quoted line strips the quote off just that
  // line and drops it as a plain line, exactly like deleting the leading `>`
  // as a character. the lines above and below stay quoted
  function handleBackspaceOnQuote(): boolean {
    const quote = closestBlock((name) => name === "BLOCKQUOTE");
    if (!(quote && caretAtLineStart(quote))) return false;
    const lines = blockLines(quote);
    const caret = caretLineIndex(quote, lines.length);
    const popped = lines[caret];
    // a hidden separator keeps a content line flush under the quote above it;
    // an empty line is just a plain <br> so a single backspace clears it
    const empty = popped.length === 0;

    const replacement = document.createDocumentFragment();
    if (caret > 0) {
      replacement.appendChild(buildQuote(lines.slice(0, caret)));
      if (!empty) replacement.appendChild(createComposerBlockSeparator());
    }
    const marker = document.createTextNode("");
    const br = document.createElement("br");
    replacement.appendChild(empty ? br : marker);
    for (const node of popped) replacement.appendChild(node);
    if (caret < lines.length - 1) {
      if (!empty) replacement.appendChild(createComposerBlockSeparator());
      replacement.appendChild(buildQuote(lines.slice(caret + 1)));
    }
    quote.replaceWith(replacement);
    if (empty) caretAfter(br);
    else placeCaretInText(marker, 0);
    syncFromDom();
    return true;
  }

  // backspace at the start of a heading or code block removes the block
  // formatting and leaves the content behind as plain lines
  function unwrapBlock(block: HTMLElement): boolean {
    const before = block.previousSibling;
    const after = block.nextSibling;
    const frag = document.createDocumentFragment();
    const marker = document.createTextNode("");
    frag.appendChild(marker);
    const lines = blockLines(block);
    lines.forEach((line, i) => {
      if (i > 0) frag.appendChild(document.createElement("br"));
      for (const node of line) frag.appendChild(node);
    });
    block.replaceWith(frag);
    normalizeSeparator(before);
    normalizeSeparator(after);
    placeCaretInText(marker, 0);
    syncFromDom();
    return true;
  }
  function handleBackspaceOnHeading(): boolean {
    const heading = closestBlock((name) => HEADING_TAG_RE.test(name));
    if (!(heading && caretAtLineStart(heading))) return false;
    return unwrapBlock(heading);
  }
  function handleBackspaceOnCodeBlock(): boolean {
    const pre = closestBlock((name) => name === "PRE");
    if (!(pre && caretAtLineStart(pre))) return false;
    return unwrapBlock(pre);
  }
  function handleBackspaceOnDivider(): boolean {
    const el = ref.get();
    const sel = window.getSelection();
    if (!(el && sel?.isCollapsed) || sel.rangeCount === 0) return false;
    const { startContainer, startOffset } = sel.getRangeAt(0);
    let hr: Node | null = null;
    if (startContainer.nodeType === Node.TEXT_NODE) {
      if (startOffset !== 0 || startContainer.parentNode !== el) return false;
      let prev: Node | null = startContainer.previousSibling;
      while (prev && prev.nodeType === Node.TEXT_NODE && !(prev as Text).length)
        prev = prev.previousSibling;
      if (prev?.nodeName === "HR") hr = prev;
    } else if (startContainer === el) {
      const candidate = el.childNodes[startOffset - 1];
      if (candidate?.nodeName === "HR") hr = candidate;
    }
    if (!hr) return false;
    const before = hr.previousSibling;
    const after = hr.nextSibling;
    const br = document.createElement("br");
    (hr as ChildNode).replaceWith(br);
    normalizeSeparator(before);
    normalizeSeparator(after);
    caretAfter(br);
    syncFromDom();
    return true;
  }

  function handleShiftEnterInHeader(): boolean {
    const el = ref.get();
    const sel = window.getSelection();
    if (!(el && sel) || sel.rangeCount === 0) return false;
    let n: Node | null = sel.getRangeAt(0).startContainer;
    while (n && n !== el && !HEADING_TAG_RE.test(n.nodeName)) n = n.parentNode;
    if (!n || n === el) return false;
    const heading = n as HTMLElement;
    heading.after(document.createElement("br"));
    caretAfter(heading);
    syncFromDom();
    return true;
  }
  function handleShiftEnterInList(): boolean {
    const el = ref.get();
    const sel = window.getSelection();
    if (!(el && sel) || sel.rangeCount === 0) return false;
    const li = closestListItem(sel.getRangeAt(0).startContainer, el);
    if (!li) return false;
    if ((li.textContent ?? "").trim() === "") {
      const list = li.parentElement;
      if (!list) return true;
      const nextLi = li.nextElementSibling as HTMLElement | null;
      const prevLi = li.previousElementSibling as HTMLElement | null;
      li.remove();
      if (list.children.length === 0) {
        const br = document.createElement("br");
        list.replaceWith(br);
        const r = document.createRange();
        r.setStartAfter(br);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      } else if (nextLi) {
        placeCaretAtStart(nextLi);
      } else if (prevLi) {
        placeCaretAtEnd(prevLi);
      }
    } else {
      const newLi = document.createElement("li");
      newLi.appendChild(document.createElement("br"));
      li.after(newLi);
      placeCaretAtStart(newLi);
    }
    syncFromDom();
    return true;
  }
  function normalizeStrayEmptyBlock() {
    const el = ref.get();
    if (el?.childNodes.length !== 1) return;
    const only = el.firstChild as HTMLElement;
    if (only.nodeType !== Node.ELEMENT_NODE || (only.textContent ?? "").trim()) return;
    if (
      only.tagName === "PRE" ||
      only.tagName === "BLOCKQUOTE" ||
      only.tagName === "UL" ||
      only.tagName === "OL" ||
      HEADING_TAG_RE.test(only.tagName) ||
      only.tagName === "HR"
    ) {
      el.innerHTML = "";
    }
  }
  return {
    handleBackspaceOnCodeBlock,
    handleBackspaceOnDivider,
    handleBackspaceOnHeading,
    handleBackspaceOnQuote,
    handleShiftEnterInHeader,
    handleShiftEnterInList,
    normalizeStrayEmptyBlock,
  };
}
