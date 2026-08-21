import { debugMode, MenuItem, showDebugInfo } from "@slock/ui";
import { Show } from "solid-js";
import { copyMessageLink } from "../../../lib/messageLinks";
import { store } from "../../../lib/store";
import { openConversationInSplit } from "../../navigation/SplitNavigation";
import type { ActivityRow } from "./ActivityRow";

export interface ActivityRowMenuItemsProps {
  row: ActivityRow;
  onClose: () => void;
  onSeen: (items: ActivityRow["items"]) => void;
}

export default function ActivityRowMenuItems(props: ActivityRowMenuItemsProps) {
  const latest = () => props.row.items[0];
  const canUnsubscribe = () =>
    props.row.isThread &&
    !!latest().threadTs &&
    !store.messages.isThreadUnsubscribed(latest().channelId, latest().threadTs as string);
  const isUnread = () => store.activity.isActivityItemUnread(latest());

  const run = (fn: () => void) => {
    props.onClose();
    fn();
  };

  const copyLink = () => copyMessageLink(latest().channelId, latest().ts, latest().threadTs);

  const openInSplit = () => {
    props.onSeen(props.row.items);
    const item = latest();
    if (item.threadTs)
      store.viewState.openThread(item.channelId, item.threadTs, item.ts, { pinned: true });
    else openConversationInSplit(item.channelId, item.ts);
  };

  const markRead = () => props.onSeen(props.row.items);
  const markUnread = () => store.messages.markMessageUnread(latest().channelId, latest().ts);

  const unsubscribe = () => {
    const item = latest();
    if (!item.threadTs) return;
    store.messages.unsubscribeFromThread(item.channelId, item.threadTs);
    props.onSeen(props.row.items);
  };

  const showDebug = () => showDebugInfo(`Activity row: ${props.row.key}`, props.row.items);

  return (
    <>
      <MenuItem icon="link" onClick={() => run(copyLink)}>
        Copy link
      </MenuItem>
      <MenuItem icon="move-to-split-view" onClick={() => run(openInSplit)}>
        Open in split view
      </MenuItem>
      <Show
        fallback={
          <MenuItem icon="mark-as-unread" onClick={() => run(markUnread)}>
            Mark unread
          </MenuItem>
        }
        when={isUnread()}
      >
        <MenuItem icon="mark-as-read" onClick={() => run(markRead)}>
          Mark read
        </MenuItem>
      </Show>
      <Show when={canUnsubscribe()}>
        <MenuItem icon="notifications-off" onClick={() => run(unsubscribe)}>
          Unsubscribe from thread
        </MenuItem>
      </Show>
      <Show when={debugMode()}>
        <MenuItem icon="bug" onClick={() => run(showDebug)}>
          Show debug info
        </MenuItem>
      </Show>
    </>
  );
}
