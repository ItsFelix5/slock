import { closestListItem, placeCaretAtEnd, placeCaretAtStart, placeCaretInText } from "../richtext";
import { HEADING_TAG_RE } from "../richtextSerialization";
import type { EditorRefHandle } from "./editorRef";

export function createNavigationCommands(ref: EditorRefHandle, syncFromDom: () => void) {
  function handleShiftEnterInHeader(): boolean {
    const el = ref.get();
    const sel = window.getSelection();
    if (!(el && sel) || sel.rangeCount === 0) return false;
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
  function handleBackspaceOnHeading(): boolean {
    const el = ref.get();
    const sel = window.getSelection();
    if (!(el && sel?.isCollapsed) || sel.rangeCount === 0) return false;
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
    syncFromDom();
    return true;
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
    const br = document.createElement("br");
    (hr as ChildNode).replaceWith(br);
    const r = document.createRange();
    r.setStartAfter(br);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
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
    handleBackspaceOnDivider,
    handleBackspaceOnHeading,
    handleShiftEnterInHeader,
    handleShiftEnterInList,
    normalizeStrayEmptyBlock,
  };
}
