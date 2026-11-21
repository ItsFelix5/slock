import { defined } from "@slock/core";
import { service } from "@slock/core/solid";
import type { ActivityItem, Block, Message, SlackFile, Ts, UserId } from "@slock/types";
import { createEffect, createMemo, untrack } from "solid-js";
import type { MessageAuthorFields } from "../../../messages/client/api/messageAuthor";

const messagesStore = service("messages");
const activityStore = service("activity");

const MAX_INITIAL_TIMELINE_ENTRIES = 20;

export interface TimelineEntry {
  isRoot: boolean;
  item?: ActivityItem;
  message?: Message;
  ts: Ts;
}

export function createActivityTimeline(deps: {
  currentUserId: () => UserId | undefined;
  expanded: () => boolean;
  isThreadGroup: () => boolean;
  items: () => ActivityItem[];
  latest: () => ActivityItem;
  threadTs: () => Ts;
}) {
  createEffect(
    () =>
      deps.isThreadGroup()
        ? { channelId: deps.latest().channelId, threadTs: deps.threadTs() }
        : undefined,
    (thread) => {
      if (thread) messagesStore.ensureThreadRepliesLoaded(thread.channelId, thread.threadTs);
    },
  );
  const fullThread = createMemo(() =>
    messagesStore.hasMoreReplies(deps.threadTs())
      ? undefined
      : messagesStore.messagesInThread(deps.threadTs()),
  );
  const orderedItems = createMemo(() => [...deps.items()].reverse());
  const activityByTs = createMemo(() => {
    const map = new Map<Ts, ActivityItem>();
    for (const item of deps.items()) map.set(item.ts, item);
    return map;
  });

  const bundledItem = createMemo(() =>
    deps.items().find((item) => item.kind === "thread_reply" && (item.unreadCount ?? 0) > 1),
  );

  const timeline = createMemo<TimelineEntry[]>((previous) => {
    const cache = new Map((previous ?? []).map((entry) => [entry.ts, entry]));
    const entryFor = (
      ts: Ts,
      isRoot: boolean,
      item: ActivityItem | undefined,
      message: Message | undefined,
    ): TimelineEntry => {
      const cached = cache.get(ts);
      return cached &&
        cached.isRoot === isRoot &&
        cached.item === item &&
        cached.message === message
        ? cached
        : { isRoot, item, message, ts };
    };
    const list = fullThread();
    if (!list || list.length === 0) {
      return orderedItems().map((item) => entryFor(item.ts, false, item, undefined));
    }
    const byTs = activityByTs();
    return list.map((message) =>
      entryFor(message.ts, message.ts === deps.threadTs(), byTs.get(message.ts), message),
    );
  });

  function entryUserId(entry: TimelineEntry): UserId | undefined {
    return entry.message?.userId ?? entry.item?.userId;
  }

  function entryUnread(entry: TimelineEntry): boolean {
    const author = entryUserId(entry);
    if (author && author === deps.currentUserId()) return false;
    if (entry.item) return activityStore.isActivityItemUnread(entry.item);
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

  function entryFiles(entry: TimelineEntry): SlackFile[] | undefined {
    return entry.message?.files ?? entry.item?.files;
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
    if (deps.expanded() && olderEntries().length > 0) return defined(olderEntries()[0]).ts;
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
    entryFiles,
    entryText,
    entryUnread,
    firstTimelineTs,
    lastTimelineTs,
    olderEntries,
    visibleEntries,
  };
}
