import { store } from "../store";

export function viewForConversation(channelId: string) {
  return { id: channelId, kind: store.dms.conversationKind(channelId) };
}

export function openConversationInSplit(channelId: string, ts?: string) {
  const view = viewForConversation(channelId);
  const paneId = store.panes.openInNewPane(view);
  if (ts) store.panes.setMessageTarget(paneId, { channelId, ts });
}

export function openConversation(channelId: string, options?: { keepNav?: boolean }) {
  if (options?.keepNav) store.viewState.switchToConversation(channelId, { keepNav: true });
  else store.viewState.setActiveView(viewForConversation(channelId));
}
