import { defined } from "@slock/core";
import { service } from "@slock/core/solid";
import { createSignal } from "solid-js";
import { openConversationInSplit } from "../../../conversations/client/api/nav";
import type { ActivityRow } from "./ActivityRow";

const viewStore = service("conversations");
const messageLinks = service("message-links");

const [currentRowKey, setCurrentRowKey] = createSignal<string>();

export { currentRowKey };

export const clearCurrentRow = () => setCurrentRowKey(undefined);

export function openActivityRow(row: ActivityRow, split: boolean) {
  const item = defined(row.items[0]);
  if (!item.channelId) return;
  setCurrentRowKey(row.key);
  if (split) {
    if (item.threadTs)
      messageLinks.openThread(item.channelId, item.threadTs, item.ts, { pinned: true });
    else openConversationInSplit(item.channelId, item.ts);
    return;
  }
  if (item.activityType === "quietly_added_to_channel") {
    viewStore.setActiveView({ id: item.channelId, kind: "channel" });
    return;
  }
  messageLinks.openChannelMessage(item.channelId, item.ts, item.threadTs);
}
