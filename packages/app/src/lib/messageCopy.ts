import { fragmentToMrkdwn, MRKDWN_CLIPBOARD_TYPE } from "@slock/blockkit";

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
  const text = fragmentToMrkdwn(container);
  if (!(text && e.clipboardData)) return;
  e.clipboardData.setData("text/plain", text);
  e.clipboardData.setData(MRKDWN_CLIPBOARD_TYPE, text);
  e.preventDefault();
}
