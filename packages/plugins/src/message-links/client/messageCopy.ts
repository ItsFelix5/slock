import { BLOCKS_CLIPBOARD_TYPE, fragmentToBlocks } from "@slock/blockkit";

const MESSAGE_CONTENT_SELECTOR = ".message-list, .thread-panel-messages";

export function handleMessageCopy(e: ClipboardEvent) {
  if (e.defaultPrevented) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const anchor =
    range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  if (!anchor?.closest(MESSAGE_CONTENT_SELECTOR)) return;
  const container = document.createElement("div");
  container.appendChild(range.cloneContents());
  const blocks = fragmentToBlocks(container);
  if (!(blocks.length && e.clipboardData)) return;
  e.clipboardData.setData("text/plain", sel.toString());
  e.clipboardData.setData("text/html", container.innerHTML);
  e.clipboardData.setData(BLOCKS_CLIPBOARD_TYPE, JSON.stringify(blocks));
  e.preventDefault();
}
