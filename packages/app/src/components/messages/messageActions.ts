import type { Message } from "@slock/slack-api";
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

export function confirmAndDeleteMessage(channelId: string, ts: string) {
  if (confirm("Delete this message?")) store.messages.deleteMessageAt(channelId, ts);
}
