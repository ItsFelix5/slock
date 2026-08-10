import { fragmentToMrkdwn } from "@slock/blockkit";

// Selecting part of a sent message (mentions, channel/date chips, emoji,
// links, formatting — all plain read-only DOM, see MessageRow / blockkit's
// Mrkdwn and RichText) and copying it should produce the same Slack token
// syntax the composer emits on its own copy (selectionCommands.ts's
// copySelection) — that's what lets a copied message round-trip back into
// the composer as real chips instead of dead display text. Global rather
// than per-component so it covers every surface that renders message
// content (channel view, thread panel) without wiring a handler into each.
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
  e.preventDefault();
}
