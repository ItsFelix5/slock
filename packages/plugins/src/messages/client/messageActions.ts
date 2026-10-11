import { service } from "@slock/core/solid";
import type { Message } from "@slock/types";
import { confirmDialog } from "@slock/ui";

const feedback = service("feedback");

const messagesStore = service("messages");

export function copyMessageText(msg: Message) {
  const body = document.querySelector<HTMLElement>(
    `[data-message-ts="${CSS.escape(msg.ts)}"] .message-text`,
  );
  const selection = window.getSelection();
  if (!(body && selection)) {
    feedback.flash(msg.ts, "Couldn't copy the message text.", "error");
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(body);
  selection.removeAllRanges();
  selection.addRange(range);
  const copied = document.execCommand("copy");
  selection.removeAllRanges();
  if (!copied) feedback.flash(msg.ts, "Couldn't copy the message text.", "error");
}

export async function deleteOrDismissMessage(channelId: string, msg: Message) {
  if (msg.deleted) {
    messagesStore.dismissMessage(channelId, msg.ts);
    return;
  }
  const confirmed = await confirmDialog({
    confirmLabel: "Delete",
    danger: true,
    message: "Delete this message?",
  });
  if (confirmed) messagesStore.deleteMessageAt(channelId, msg.ts);
}
