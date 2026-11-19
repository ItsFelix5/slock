import type { ChannelId, Ts } from "@slock/types";
import { service } from "@slock/core/solid";
import type { View } from "./types";

const conversations = service("conversations");
const panes = service("shell.panes");

export function viewForConversation(channelId: ChannelId) {
  return conversations.viewFor(channelId);
}

export function openConversationInSplit(channelId: ChannelId, ts?: Ts) {
  const paneId = panes.openInNewPane(viewForConversation(channelId));
  if (ts) conversations.setMessageTarget(paneId, { channelId, ts });
}

export function openConversation(channelId: ChannelId) {
  conversations.setActiveView(viewForConversation(channelId));
}

export function conversationTarget(id: ChannelId, kind: View["kind"]) {
  return {
    active: conversations.isOpenInAnyPane(id, kind),
    open: (split: boolean) => (split ? openConversationInSplit(id) : openConversation(id)),
  };
}
