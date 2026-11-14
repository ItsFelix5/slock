import { service } from "@slock/core/solid";
import type { View } from "./types";

const conversations = service("conversations");
const panes = service("shell.panes");

export function viewForConversation(channelId: string) {
  return conversations.viewFor(channelId);
}

export function openConversationInSplit(channelId: string, ts?: string) {
  const paneId = panes.openInNewPane(viewForConversation(channelId));
  if (ts) conversations.setMessageTarget(paneId, { channelId, ts });
}

export function openConversation(channelId: string) {
  conversations.setActiveView(viewForConversation(channelId));
}

export function conversationTarget(id: string, kind: View["kind"]) {
  return {
    active: conversations.isOpenInAnyPane(id, kind),
    open: (split: boolean) => (split ? openConversationInSplit(id) : openConversation(id)),
  };
}
