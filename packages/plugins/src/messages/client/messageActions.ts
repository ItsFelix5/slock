import { service } from "@slock/core/solid";
import type { Message } from "@slock/types";
import { confirmDialog } from "@slock/ui";

const feedback = service("feedback");

const messagesStore = service("messages");

export async function copyMessageText(msg: Message) {
  const body = document.querySelector<HTMLElement>(
    `[data-message-ts="${CSS.escape(msg.ts)}"] .message-text`,
  );
  const copied =
    body &&
    (await navigator.clipboard.writeText(body.innerText).then(
      () => true,
      () => false,
    ));
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
