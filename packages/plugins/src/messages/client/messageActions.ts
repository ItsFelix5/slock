import { service } from "@slock/core/solid";
import type { ChannelId, Message } from "@slock/types";
import { domToMarkdown } from "@slock/ui";

const dialogs = service("shell.dialogs");

const feedback = service("feedback");

const messagesStore = service("messages");

export async function copyMessageText(msg: Message) {
  const body = document.querySelector<HTMLElement>(
    `[data-message-ts="${CSS.escape(msg.ts)}"] .message-text`,
  );
  const copied =
    body &&
    (await navigator.clipboard.writeText(domToMarkdown(body)).then(
      () => true,
      () => false,
    ));
  if (!copied) feedback.flash(msg.ts, "Couldn't copy the message text.", "error");
}

export async function deleteOrDismissMessage(channelId: ChannelId, msg: Message) {
  if (msg.deleted) {
    messagesStore.dismissMessage(channelId, msg.ts);
    return true;
  }
  const confirmed = await dialogs.confirm({
    confirmLabel: "Delete",
    danger: true,
    message: "Delete this message?",
  });
  if (confirmed) messagesStore.deleteMessageAt(channelId, msg.ts);
  return confirmed;
}
