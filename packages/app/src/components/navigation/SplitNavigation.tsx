import type { JSX } from "solid-js";
import { conversationKind } from "../../lib/dmId";
import { store } from "../../lib/store";

export function viewForConversation(channelId: string) {
  return {
    id: channelId,
    kind: conversationKind(channelId, (id) => !!store.dms.dmById(id)),
  };
}

export function openConversationInSplit(channelId: string, ts?: string) {
  const view = viewForConversation(channelId);
  const paneId = store.panes.openInNewPane(view);
  if (ts) store.panes.setMessageTarget(paneId, { channelId, ts });
}

export function openConversation(channelId: string) {
  store.viewState.setActiveView(viewForConversation(channelId));
}

export function SplitNavigation(props: { children: JSX.Element; onSplit: () => void }) {
  return (
    <span
      onClick={(event) => {
        if (!(event.ctrlKey || event.metaKey) || event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        props.onSplit();
      }}
      style={{ display: "contents" }}
    >
      {props.children}
    </span>
  );
}
