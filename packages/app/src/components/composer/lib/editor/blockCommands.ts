// biome-ignore-all lint/performance/useTopLevelRegex: These expressions are local to command parsing.
import { store } from "../../../../lib/store";
import {
  createComposerBlockSeparator,
  createDateChip,
  createDividerElement,
  createHeaderElement,
  createMentionChip,
  expandRangeToLines,
  placeCaretAtEnd,
  placeCaretAtStart,
  placeCaretInText,
} from "../richtext";
import { HEADING_TAG_RE } from "../richtextSerialization";
import type { EditorRefHandle } from "./editorRef";
import { createNavigationCommands } from "./navigationCommands";
export function createBlockCommands(
  ref: EditorRefHandle,
  opts: {
    focusEditor: () => void;
    syncFromDom: () => void;
    currentTextContext: () => { node: Text; offset: number } | null;
    closeSuggestions: () => void;
  },
) {
  const navigation = createNavigationCommands(ref, opts.syncFromDom);
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
    if (!(el && sel) || sel.rangeCount === 0) return;
    opts.focusEditor();
    const original = sel.getRangeAt(0);
    const lineRange = expandRangeToLines(el, original);
    if (lineRange) {
      const contents = lineRange.extractContents();
      const container = build(contents);
      lineRange.insertNode(container);
      if (container.textContent || container.querySelector("br")) {
        placeCaretAtEnd(container);
      } else {
        container.appendChild(document.createElement("br"));
        placeCaretAtStart(container);
      }
    } else {
      const container = build(document.createDocumentFragment());
      container.appendChild(document.createElement("br"));
      original.insertNode(container);
      placeCaretAtStart(container);
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
    const el = ref.get();
    const sel = window.getSelection();
    if (!(el && sel) || sel.rangeCount === 0) return;
    opts.focusEditor();
    const original = sel.getRangeAt(0);
    const lineRange = expandRangeToLines(el, original);
    const contents = lineRange?.extractContents() ?? document.createDocumentFragment();
    const result = document.createDocumentFragment();
    let quote = document.createElement("blockquote");
    quote.className = "composer-quote";
    result.appendChild(quote);
    for (const node of Array.from(contents.childNodes)) {
      if (node.nodeName === "BR") {
        if (!quote.childNodes.length) quote.appendChild(document.createElement("br"));
        result.appendChild(createComposerBlockSeparator());
        quote = document.createElement("blockquote");
        quote.className = "composer-quote";
        result.appendChild(quote);
      } else {
        quote.appendChild(node);
      }
    }
    if (!quote.childNodes.length) quote.appendChild(document.createElement("br"));
    if (lineRange) lineRange.insertNode(result);
    else original.insertNode(result);
    placeCaretAtEnd(quote);
    opts.syncFromDom();
  }
  function applyList(ordered: boolean) {
    const el = ref.get();
    const sel = window.getSelection();
    if (!(el && sel) || sel.rangeCount === 0) return;
    opts.focusEditor();
    const original = sel.getRangeAt(0);
    const lineRange = expandRangeToLines(el, original);
    const list = document.createElement(ordered ? "ol" : "ul");
    list.className = "composer-list";
    let li = document.createElement("li");
    list.appendChild(li);
    if (lineRange) {
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
      if (lastLi.textContent || lastLi.querySelector("br")) {
        placeCaretAtEnd(lastLi);
      } else {
        lastLi.appendChild(document.createElement("br"));
        placeCaretAtStart(lastLi);
      }
    } else {
      li.appendChild(document.createElement("br"));
      original.insertNode(list);
      placeCaretAtStart(li);
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
    const chip = createMentionChip(id, store.users.userById(id)?.name ?? id);
    range.insertNode(chip);
    const space = document.createTextNode(" ");
    chip.after(space);
    placeCaretInText(space, 1);
    opts.syncFromDom();
  }
  function insertDateChipAtCaret(timestamp: number, format?: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const chip = createDateChip(timestamp, format);
    range.insertNode(chip);
    const space = document.createTextNode(" ");
    chip.after(space);
    placeCaretInText(space, 1);
    opts.syncFromDom();
  }
  function insertLineBreak() {
    opts.focusEditor();
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
    let target = br.nextSibling;
    if (!target || target.nodeType !== Node.TEXT_NODE) {
      target = document.createTextNode("");
      br.after(target);
    }
    if (!((target as Text).length || target.nextSibling))
      target.after(document.createElement("br"));
    placeCaretInText(target as Text, 0);
    opts.syncFromDom();
  }
  function maybeApplyLineTrigger(): boolean {
    const el = ref.get();
    const ctx = opts.currentTextContext();
    if (!(el && ctx)) return false;
    const { node, offset } = ctx;
    if (node.parentNode !== el) return false;
    const LineBoundary = ["BR", "HR", "PRE", "BLOCKQUOTE", "UL", "OL"];
    let prev = node.previousSibling;
    while (prev && prev.nodeType === Node.TEXT_NODE && !(prev as Text).length) {
      prev = prev.previousSibling;
    }
    if (prev && !LineBoundary.includes(prev.nodeName) && !HEADING_TAG_RE.test(prev.nodeName))
      return false;
    const before = (node.textContent ?? "").slice(0, offset);
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
    insertDateChipAtCaret,
    insertLineBreak,
    insertMentionChipAtCaret,
    insertPlainTextAtCaret,
    ...navigation,
    maybeApplyLineTrigger,
  };
}
