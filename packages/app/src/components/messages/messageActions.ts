import type { Message } from "@slock/slack-api";
import { confirmDialog } from "@slock/ui";
import { parseReplyLink } from "../../lib/replyLink";
import { actionFeedback, store } from "../../lib/store";

export async function copyMessageText(
  msg: Message,
  isInThread: (channelId: string, ts: string) => boolean,
) {
  try {
    await navigator.clipboard.writeText(parseReplyLink(msg.text, isInThread)?.rest ?? msg.text);
  } catch {
    actionFeedback.flash(msg.ts, "Couldn't copy the message text.", "error");
  }
}

export async function confirmAndDeleteMessage(channelId: string, ts: string) {
  const confirmed = await confirmDialog({
    confirmLabel: "Delete",
    danger: true,
    message: "Delete this message?",
  });
  if (confirmed) store.messages.deleteMessageAt(channelId, ts);
}
