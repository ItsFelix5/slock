import type { Message } from "@slock/types";
import { confirmDialog, showDebugInfo } from "@slock/ui";
import { actionFeedback } from "../../lib/feedback";
import { store } from "../../lib/store";

export function copyMessageText(msg: Message) {
  const body = document.querySelector<HTMLElement>(
    `[data-message-ts="${CSS.escape(msg.ts)}"] .message-text`,
  );
  const selection = window.getSelection();
  if (!(body && selection)) {
    actionFeedback.flash(msg.ts, "Couldn't copy the message text.", "error");
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(body);
  selection.removeAllRanges();
  selection.addRange(range);
  const copied = document.execCommand("copy");
  selection.removeAllRanges();
  if (!copied) actionFeedback.flash(msg.ts, "Couldn't copy the message text.", "error");
}

export function showMessageDebugInfo(msg: Message) {
  showDebugInfo(`Message ${msg.ts}`, msg);
}

export async function confirmAndDeleteMessage(channelId: string, ts: string) {
  const confirmed = await confirmDialog({
    confirmLabel: "Delete",
    danger: true,
    message: "Delete this message?",
  });
  if (confirmed) store.messages.deleteMessageAt(channelId, ts);
}
