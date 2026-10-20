import { defined } from "@slock/core";
import { Slot, service } from "@slock/core/solid";
import { MenuItem } from "@slock/ui";
import { Show } from "solid-js";
import { openConversationInSplit } from "../../../conversations/client/api/nav";
import { copyMessageLink } from "../../../message-links/client/api/messageLinks";
import type { ActivityRow } from "./ActivityRow";

const messageLinks = service("message-links");
const messagesStore = service("messages");
const activityStore = service("activity");

export interface ActivityRowMenuItemsProps {
  row: ActivityRow;
  onClose: () => void;
  onSeen: (items: ActivityRow["items"]) => void;
}

export default function ActivityRowMenuItems(props: ActivityRowMenuItemsProps) {
  const latest = () => defined(props.row.items[0]);
  const canUnsubscribe = () => {
    const item = latest();
    return (
      props.row.isThread &&
      !!item.threadTs &&
      !messagesStore.isThreadUnsubscribed(item.channelId, item.threadTs)
    );
  };
  const isUnread = () => activityStore.isActivityItemUnread(latest());

  const run = (fn: () => void) => {
    props.onClose();
    fn();
  };

  const copyLink = () => copyMessageLink(latest().channelId, latest().ts, latest().threadTs);

  const openInSplit = () => {
    const item = latest();
    if (item.threadTs)
      messageLinks.openThread(item.channelId, item.threadTs, item.ts, { pinned: true });
    else openConversationInSplit(item.channelId, item.ts);
  };

  const markRead = () => props.onSeen(props.row.items);
  const markUnread = () => {
    messagesStore.markMessageUnread(latest().channelId, latest().ts, latest().threadTs);
    activityStore.markActivityItemUnread(latest());
  };

  const unsubscribe = () => {
    const item = latest();
    if (!item.threadTs) return;
    messagesStore.unsubscribeFromThread(item.channelId, item.threadTs);
    props.onSeen(props.row.items);
  };

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
      <Slot close={props.onClose} point="activity.menu" row={props.row} />
    </>
  );
}
