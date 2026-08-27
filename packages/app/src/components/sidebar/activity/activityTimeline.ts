import { createEffect, createMemo, untrack } from "solid-js";
import type { ActivityItem, Block, Message } from "../../../lib/api";
import { store } from "../../../lib/store";
import type { MessageAuthorFields } from "../../messages/parts/messageRenderState";

const MAX_INITIAL_TIMELINE_ENTRIES = 20;

export interface TimelineEntry {
  isRoot: boolean;
  item?: ActivityItem;
  message?: Message;
  ts: string;
}

export function createActivityTimeline(deps: {
  currentUserId: () => string | undefined;
  expanded: () => boolean;
  isThreadGroup: () => boolean;
  items: () => ActivityItem[];
  latest: () => ActivityItem;
  threadTs: () => string;
}) {
  createEffect(() => {
    if (!(deps.isThreadGroup() && deps.expanded())) return;
    store.messages.ensureThreadRepliesLoaded(deps.latest().channelId, deps.threadTs());
  });
  const fullThread = createMemo(() => store.messages.messagesInThread(deps.threadTs()));
  const orderedItems = createMemo(() => [...deps.items()].reverse());
  const activityByTs = createMemo(() => {
    const map = new Map<string, ActivityItem>();
    for (const item of deps.items()) map.set(item.ts, item);
    return map;
  });

  const bundledItem = createMemo(() =>
    deps.items().find((item) => item.kind === "thread_reply" && (item.unreadCount ?? 0) > 1),
  );

  const timeline = createMemo<TimelineEntry[]>(() => {
    const list = fullThread();
    if (list && list.length > 0) {
      const byTs = activityByTs();
      return list.map((message) => ({
        isRoot: message.ts === deps.threadTs(),
        item: byTs.get(message.ts),
        message,
        ts: message.ts,
      }));
    }
    return orderedItems().map((item) => ({ isRoot: false, item, ts: item.ts }));
  });

  function entryUserId(entry: TimelineEntry): string {
    return entry.message?.userId ?? entry.item?.userId ?? "";
  }

  function entryUnread(entry: TimelineEntry): boolean {
    if (entryUserId(entry) === deps.currentUserId()) return false;
    if (entry.item) return store.activity.isActivityItemUnread(entry.item);
    const bundled = bundledItem();
    const list = fullThread();
    if (bundled?.unreadCount && list) {
      const tailStart = list.length - Math.min(bundled.unreadCount, list.length);
      const index = list.findIndex((message) => message.ts === entry.ts);
      return index >= tailStart;
    }

    return false;
  }

  function entryText(entry: TimelineEntry): string {
    return entry.message?.text || entry.item?.text || "";
  }

  function entryBlocks(entry: TimelineEntry): Block[] | undefined {
    return entry.message?.blocks ?? entry.item?.blocks;
  }

  function entryAuthor(entry: TimelineEntry): MessageAuthorFields {
    return {
      botIcon: entry.message?.botIcon ?? entry.item?.botIcon,
      botId: entry.message?.botId ?? entry.item?.botId,
      botName: entry.message?.botName ?? entry.item?.botName,
      userId: entryUserId(entry),
    };
  }

  const visibleStartIndex = createMemo(() => {
    const entries = timeline();
    return untrack(() => {
      const idx = entries.findIndex(entryUnread);
      const firstUnread = idx === -1 ? entries.length - 1 : idx;
      return Math.max(firstUnread, entries.length - MAX_INITIAL_TIMELINE_ENTRIES);
    });
  });
  const olderEntries = createMemo(() => timeline().slice(0, visibleStartIndex()));
  const visibleEntries = createMemo(() => timeline().slice(visibleStartIndex()));

  const firstTimelineTs = createMemo(() => {
    if (deps.expanded() && olderEntries().length > 0) return olderEntries()[0].ts;
    return visibleEntries()[0]?.ts;
  });
  const lastTimelineTs = createMemo(() => {
    const entries = visibleEntries();
    return entries[entries.length - 1]?.ts;
  });
  const hiddenMessageCount = createMemo(() => olderEntries().length);
  const earlierMessageCount = createMemo(() =>
    Math.max(hiddenMessageCount(), (bundledItem()?.unreadCount ?? 1) - 1),
  );

  return {
    earlierMessageCount,
    entryAuthor,
    entryBlocks,
    entryText,
    entryUnread,
    firstTimelineTs,
    lastTimelineTs,
    olderEntries,
    visibleEntries,
  };
}
