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
  if (ts) {
    store.tiling.openMessageInSplit(view, { channelId, ts });
    return;
  }
  store.tiling.openViewInSplit(view);
}

export function SplitNavigation(props: { children: JSX.Element; onSplit: () => void }) {
  return (
    <span
      onAuxClick={(event) => {
        if (event.button !== 1 || event.defaultPrevented) return;
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
