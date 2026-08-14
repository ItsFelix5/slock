import type { JSX } from "solid-js";
import { store } from "../../lib/store";

function viewForConversation(channelId: string) {
  return {
    id: channelId,
    kind: store.dms.dmById(channelId) ? ("dm" as const) : ("channel" as const),
  };
}

export function openConversationInSplit(channelId: string, ts?: string) {
  const view = viewForConversation(channelId);
  const paneId = store.panes.openInNewPane(view);
  if (ts) store.panes.setMessageTarget(paneId, { channelId, ts });
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
