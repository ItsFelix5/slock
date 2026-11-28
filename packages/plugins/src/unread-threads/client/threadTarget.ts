import { service } from "@slock/core/solid";
import type { CycleTarget } from "@slock/plugins/sidebar/client/api";
import type { ActivityItem } from "@slock/types";

const messageLinks = service("message-links");
const panes = service("shell.panes");

const threadTsOf = (item: ActivityItem) => item.threadTs ?? item.ts;

export function openUnreadThread(item: ActivityItem, split: boolean) {
  if (split) messageLinks.openThread(item.channelId, threadTsOf(item), item.ts, { pinned: true });
  else messageLinks.openChannelPeek(item.channelId, threadTsOf(item), item.ts);
}

export function unreadThreadTarget(item: ActivityItem): CycleTarget {
  return {
    active: panes
      .panes()
      .some(
        ({ content }) =>
          content?.kind === "thread" &&
          content.channelId === item.channelId &&
          content.ts === threadTsOf(item),
      ),
    open: (split) => openUnreadThread(item, split),
  };
}
