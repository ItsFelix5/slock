import { userById } from "../../../../lib/store";
import {
  closestListItem,
  createDateChip,
  createDividerElement,
  createHeaderElement,
  createMentionChip,
  expandRangeToLines,
  HEADING_TAG_RE,
  placeCaretAtEnd,
  placeCaretAtStart,
  placeCaretInText,
} from "../richtext";
import type { EditorRefHandle } from "./editorRef";

// Inline marks, block formatting (headers/lists/quotes/code), and the
// markdown-style line triggers that turn "# " / "> " / "```" etc. into real
// elements — the part of editorCommands.ts that isn't caret/selection
// plumbing (see selectionCommands.ts for that).
export function createBlockCommands(
  ref: EditorRefHandle,
  opts: {
    focusEditor: () => void;
    syncFromDom: () => void;
    currentTextContext: () => { node: Text; offset: number } | null;
    closeSuggestions: () => void;
  },
) {
  function applyMark(mark: "bold" | "italic" | "strike" | "code") {
    opts.focusEditor();
    if (mark === "code") {
      toggleInlineCode();
    } else {
      const command = mark === "bold" ? "bold" : mark === "italic" ? "italic" : "strikeThrough";
      document.execCommand(command);
    }
    opts.syncFromDom();
  }

  function toggleInlineCode() {
    const sel = window.getSelection();
    const el = ref.get();
    if (!sel || sel.rangeCount === 0 || !el) return;
    const range = sel.getRangeAt(0);
    let ancestor: Node | null =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentNode
        : range.commonAncestorContainer;
    while (ancestor && ancestor !== el && ancestor.nodeName !== "CODE") {
      ancestor = ancestor.parentNode;
    }
    if (ancestor && ancestor.nodeName === "CODE") {
      const parent = ancestor.parentNode;
      if (!parent) return;
      while (ancestor.firstChild) parent.insertBefore(ancestor.firstChild, ancestor);
      parent.removeChild(ancestor);
      return;
    }
    if (range.collapsed) {
      const code = document.createElement("code");
      code.appendChild(document.createTextNode("​"));
      range.insertNode(code);
      placeCaretAtEnd(code);
    } else {
      const code = document.createElement("code");
      code.appendChild(range.extractContents());
      range.insertNode(code);
      const r = document.createRange();
      r.setStartAfter(code);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  }

  function wrapCurrentLinesInBlock(build: (contents: DocumentFragment) => HTMLElement) {
    const el = ref.get();
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    opts.focusEditor();
    const original = sel.getRangeAt(0);
    const lineRange = expandRangeToLines(el, original);
    if (!lineRange) {
      const container = build(document.createDocumentFragment());
      container.appendChild(document.createElement("br"));
      original.insertNode(container);
      placeCaretAtStart(container);
    } else {
      const contents = lineRange.extractContents();
      const container = build(contents);
      lineRange.insertNode(container);
      // A trigger typed on an empty line wraps no content — give the block a
      // placeholder <br> so it stays visible and the caret can sit inside it.
      if (!container.textContent && !container.querySelector("br")) {
        container.appendChild(document.createElement("br"));
        placeCaretAtStart(container);
      } else {
        placeCaretAtEnd(container);
      }
    }
    opts.syncFromDom();
  }

  function applyCodeBlock() {
    wrapCurrentLinesInBlock((frag) => {
      const pre = document.createElement("pre");
      pre.className = "composer-pre";
      pre.appendChild(frag);
      return pre;
    });
  }

  function applyHeader(level: number) {
    wrapCurrentLinesInBlock((frag) => {
      const h = createHeaderElement(level);
      h.appendChild(frag);
      return h;
    });
  }

  // Dividers are a caret-position insert, not a line wrap: the "---" marker is
  // already gone by the time this runs, so just drop an <hr> before the caret
  // and keep the (now empty) line after it for continued typing.
  function insertDividerAtCaret() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const hr = createDividerElement();
    range.insertNode(hr);
    if (!hr.nextSibling) hr.after(document.createElement("br"));
    const r = document.createRange();
    r.setStartAfter(hr);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    opts.syncFromDom();
  }

  function applyQuote() {
    wrapCurrentLinesInBlock((frag) => {
      const bq = document.createElement("blockquote");
      bq.className = "composer-quote";
      bq.appendChild(frag);
      return bq;
    });
  }

  function applyList(ordered: boolean) {
    const el = ref.get();
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    opts.focusEditor();
    const original = sel.getRangeAt(0);
    const lineRange = expandRangeToLines(el, original);
    const list = document.createElement(ordered ? "ol" : "ul");
    list.className = "composer-list";
    let li = document.createElement("li");
    list.appendChild(li);
    if (!lineRange) {
      li.appendChild(document.createElement("br"));
      original.insertNode(list);
      placeCaretAtStart(li);
    } else {
      const contents = lineRange.extractContents();
      for (const node of Array.from(contents.childNodes)) {
        if (node.nodeName === "BR") {
          li = document.createElement("li");
          list.appendChild(li);
        } else {
          li.appendChild(node);
        }
      }
      lineRange.insertNode(list);
      const lastLi = list.lastElementChild ?? list;
      if (!lastLi.textContent && !lastLi.querySelector("br")) {
        lastLi.appendChild(document.createElement("br"));
        placeCaretAtStart(lastLi);
      } else {
        placeCaretAtEnd(lastLi);
      }
    }
    opts.syncFromDom();
  }

  function insertPlainTextAtCaret(fragmentText: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const parts = fragmentText.split("\n");
    let lastNode: Text = document.createTextNode(parts[0]);
    range.insertNode(lastNode);
    for (let i = 1; i < parts.length; i++) {
      const br = document.createElement("br");
      lastNode.after(br);
      const t = document.createTextNode(parts[i]);
      br.after(t);
      lastNode = t;
    }
    placeCaretInText(lastNode, lastNode.length);
    opts.syncFromDom();
  }

  function insertMentionChipAtCaret(id: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const chip = createMentionChip(id, userById(id)?.name ?? id);
    range.insertNode(chip);
    const space = document.createTextNode(" ");
    chip.after(space);
    placeCaretInText(space, 1);
    opts.syncFromDom();
  }

  function insertDateChipAtCaret(timestamp: number) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const chip = createDateChip(timestamp);
    range.insertNode(chip);
    const space = document.createTextNode(" ");
    chip.after(space);
    placeCaretInText(space, 1);
    opts.syncFromDom();
  }

  function insertLineBreak() {
    opts.focusEditor();
    // The native command inserts the <br> AND leaves the caret with the right
    // affinity so the next character lands on the new line — something the
    // Range API can't fully reproduce. (It only emits a real <br> because
    // .composer-input is not white-space: pre-wrap; see Composer.css.)
    if (document.execCommand("insertLineBreak")) {
      opts.syncFromDom();
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const br = document.createElement("br");
    range.insertNode(br);
    // Land the caret in a real text node after the <br>: an element-anchored
    // caret there gets normalized by Chrome back to the end of the previous
    // text node, which would glue the next characters onto the old line.
    let target = br.nextSibling;
    if (!target || target.nodeType !== Node.TEXT_NODE) {
      target = document.createTextNode("");
      br.after(target);
    }
    // Placeholder <br> keeps the new line visible while it's still empty.
    if (!(target as Text).length && !target.nextSibling) target.after(document.createElement("br"));
    placeCaretInText(target as Text, 0);
    opts.syncFromDom();
  }

  // Headers are single-line (a header block holds one line of plain text), so
  // Shift+Enter inside one doesn't break the line — it exits to a fresh plain
  // line right below the header.
  function handleShiftEnterInHeader(): boolean {
    const el = ref.get();
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return false;
    let n: Node | null = sel.getRangeAt(0).startContainer;
    while (n && n !== el && !HEADING_TAG_RE.test(n.nodeName)) n = n.parentNode;
    if (!n || n === el) return false;
    const heading = n as HTMLElement;
    if (!heading.nextSibling) heading.after(document.createElement("br"));
    const r = document.createRange();
    r.setStartAfter(heading);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    opts.syncFromDom();
    return true;
  }

  // Enter inside a list item continues the list (like a real editor) rather
  // than just inserting a soft line break; an empty item exits the list.
  function handleShiftEnterInList(): boolean {
    const el = ref.get();
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return false;
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
    opts.syncFromDom();
    return true;
  }

  // Headers and dividers are "typed into existence" by a markdown trigger
  // (see maybeApplyLineTrigger) and have no visible marker afterwards, so the
  // browser's native Backspace handling on them is unpredictable — it can eat
  // extra characters, get stuck, or turn the element into a resize-selected
  // object instead of just removing it. Treat each as a single character:
  // Backspace right at its start undoes it in one press, same as deleting one
  // char, instead of that native funkiness.
  function handleBackspaceOnHeading(): boolean {
    const el = ref.get();
    const sel = window.getSelection();
    if (!el || !sel?.isCollapsed || sel.rangeCount === 0) return false;
    const { startContainer, startOffset } = sel.getRangeAt(0);

    let n: Node | null = startContainer;
    while (n && n !== el && !HEADING_TAG_RE.test(n.nodeName)) n = n.parentNode;
    if (!n || n === el) return false;
    const heading = n as HTMLElement;

    const beforeCaret = document.createRange();
    beforeCaret.selectNodeContents(heading);
    beforeCaret.setEnd(startContainer, startOffset);
    if (beforeCaret.toString().length > 0 || beforeCaret.cloneContents().querySelector("img"))
      return false;

    const before = heading.previousSibling;
    const after = heading.nextSibling;
    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createElement("br"));
    const marker = document.createTextNode("");
    frag.appendChild(marker);
    while (heading.firstChild) frag.appendChild(heading.firstChild);
    if (after) frag.appendChild(document.createElement("br"));
    heading.replaceWith(frag);
    placeCaretInText(marker, 0);
    opts.syncFromDom();
    return true;
  }

  function handleBackspaceOnDivider(): boolean {
    const el = ref.get();
    const sel = window.getSelection();
    if (!el || !sel?.isCollapsed || sel.rangeCount === 0) return false;
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

    const br = document.createElement("br");
    (hr as ChildNode).replaceWith(br);
    const r = document.createRange();
    r.setStartAfter(br);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    opts.syncFromDom();
    return true;
  }

  // Deleting through (or select-all-deleting) a code block/blockquote can
  // leave the browser's own empty block behind with the caret dropped inside
  // it — so the next character you type silently lands back in a "code
  // block" you thought you'd cleared. Once it's the *only* thing left and
  // it's empty, drop it back to plain flow.
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

  // Block formats are typed, markdown-style, at the start of a line: "# "
  // through "###### " → header (level = number of #s), "> " → quote, "- "/"* "
  // → bulleted list, "1. " → ordered list, and "```"/"---" convert the moment
  // the third character lands. Only fires for
  // bare top-level text, so a line already inside a quote/list/code block
  // can't re-trigger.
  function maybeApplyLineTrigger(): boolean {
    const el = ref.get();
    const ctx = opts.currentTextContext();
    if (!el || !ctx) return false;
    const { node, offset } = ctx;
    if (node.parentNode !== el) return false;
    // "Start of line" = nothing before, a <br>, or a block element (content
    // after a heading/HR/PRE/… starts a fresh line without any <br>). Empty
    // text nodes don't count — Chrome litters them around caret repositioning.
    const LINE_BOUNDARY = ["BR", "HR", "PRE", "BLOCKQUOTE", "UL", "OL"];
    let prev = node.previousSibling;
    while (prev && prev.nodeType === Node.TEXT_NODE && !(prev as Text).length) {
      prev = prev.previousSibling;
    }
    if (prev && !LINE_BOUNDARY.includes(prev.nodeName) && !HEADING_TAG_RE.test(prev.nodeName))
      return false;
    const before = (node.textContent ?? "").slice(0, offset);

    // Accept nbsp as the trigger space: Chrome inserts a space at the end of a line as nbsp (a plain
    // trailing space would collapse visually), and the trigger space is
    // always at the end of the line when typed.
    let action: (() => void) | undefined;
    const headerMatch = /^(#{1,6})[  ]$/.exec(before);
    if (headerMatch) action = () => applyHeader(headerMatch[1].length);
    else if (before === "---") action = insertDividerAtCaret;
    else if (before === "```") action = applyCodeBlock;
    else if (/^>[  ]$/.test(before)) action = applyQuote;
    else if (/^[-*][  ]$/.test(before)) action = () => applyList(false);
    else if (/^\d+\.[  ]$/.test(before)) action = () => applyList(true);
    if (!action) return false;

    node.deleteData(0, offset);
    placeCaretInText(node, 0);
    action();
    opts.closeSuggestions();
    opts.syncFromDom();
    return true;
  }

  return {
    applyMark,
    insertPlainTextAtCaret,
    insertMentionChipAtCaret,
    insertDateChipAtCaret,
    insertLineBreak,
    handleShiftEnterInHeader,
    handleShiftEnterInList,
    handleBackspaceOnHeading,
    handleBackspaceOnDivider,
    normalizeStrayEmptyBlock,
    maybeApplyLineTrigger,
  };
}
