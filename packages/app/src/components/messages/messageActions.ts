import { confirmDialog, showDebugInfo } from "@slock/ui";
import type { Message } from "../../lib/api";
import { actionFeedback } from "../../lib/feedback";
import { parseReplyLink } from "../../lib/replyLink";
import { store } from "../../lib/store";

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
