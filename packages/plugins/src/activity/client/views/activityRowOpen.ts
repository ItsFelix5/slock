import { defined } from "@slock/core";
import { service } from "@slock/core/solid";
import type { ActivityRow } from "./ActivityRow";

const viewStore = service("conversations");
const messageLinks = service("message-links");
const activityStore = service("activity");

export function openActivityRow(row: ActivityRow, split: boolean) {
  const item = defined(row.items[0]);
  if (!item.channelId) return;
  activityStore.setCurrentRowKey(row.key);
  if (split) {
    messageLinks.openMessageInSplit(item.channelId, item.ts, item.threadTs);
    return;
  }
  if (item.activityType === "quietly_added_to_channel") {
    viewStore.setActiveView({ id: item.channelId, kind: "channel" });
    return;
  }
  messageLinks.openChannelMessage(item.channelId, item.ts, item.threadTs);
}
