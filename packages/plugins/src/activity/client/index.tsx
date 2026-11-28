import { EmojiText } from "@slock/blockkit";
import type { Setup } from "@slock/core";
import { lazyChunk, service } from "@slock/core/solid";
import { isTs } from "@slock/slack";
import { Icon } from "@slock/ui";
import { createEffect, Show, untrack } from "solid-js";
import { createActivityStore } from "./store";

const ActivityView = lazyChunk(() => import("./views/ActivityView"));

function ActivityButton() {
  const activity = service("activity");
  return (
    <span class="sidebar-nav-btn-icon flex-center">
      <Show
        fallback={<Icon name="notifications" size={16} />}
        when={activity.recentReactionEmoji()}
      >
        {(name) => (
          <span class="sidebar-nav-reaction-emoji">
            <EmojiText text={`:${name()}:`} />
          </span>
        )}
      </Show>
      <Show when={activity.hasUnreadActivity()}>
        <span class={["sidebar-ping-dot", { "has-count": activity.unreadPingCount() > 0 }]}>
          <Show when={activity.unreadPingCount() > 0}>{activity.unreadPingCount()}</Show>
        </span>
      </Show>
    </span>
  );
}

const setup: Setup = (ctx) => {
  const messages = service("messages");
  const unread = service("unread");
  const users = service("users");
  const bootstrap = service("bootstrap");
  const prefs = service("prefs");
  const store = createActivityStore({
    cacheResolvedMessages: messages.cacheReactionMessages,
    clearChannelUnread: unread.clearChannelUnread,
    currentUser: users.currentUser,
    env: ctx.get("env"),
    ready: () =>
      !!users.currentUser() && (prefs.preferencesReady() || !!bootstrap.userPrefs().error),
    isBotUser: (userId) => !!users.userById(userId)?.isBot,
    lastReadByChannel: unread.lastReadByChannel,
    reactionMessageFor: messages.reactionMessageFor,
    setLastReadByChannel: unread.setLastReadByChannel,
    syncChannelRead: unread.syncChannelRead,
    setThreadRead: unread.setThreadRead,
    threadReadTsFor: unread.threadReadTsFor,
  });
  ctx.provide("activity", store);
  const conversations = service("conversations");
  createEffect(
    () => {
      const view = conversations.activeView();
      if (!view) return [];
      return store.activityItems.filter(
        (item) =>
          item.activityType === "quietly_added_to_channel" &&
          item.channelId === view.id &&
          store.isActivityItemUnread(item),
      );
    },
    (added) => {
      if (added.length) untrack(() => store.markActivityItemsRead(added));
    },
  );
  createEffect(
    () => bootstrap.bootstrap().data?.activityCounts,
    (counts) => {
      store.setGatewayActivityBadgeCounts(counts);
    },
  );
  ctx.add("unread.counts", (notifications) => {
    if (store.setGatewayActivityBadgeCounts(notifications)) store.requestActivityRefresh();
  });
  ctx.add("messages.deleted", store.removeActivityForMessage);
  ctx.add("realtime.handler", {
    run: (event) => {
      if (event.type === "activity") store.applyActivityEvent(event);
      if (event.type === "badge_counts_updated")
        store.setGatewayActivityBadgeCounts(event.activity_v2);
      if (
        event.type === "thread_marked" &&
        event.thread_ts &&
        isTs(event.thread_ts) &&
        typeof event.unread_count === "number"
      )
        store.applyThreadMarked(event.thread_ts, event.unread_count);
    },
    types: ["activity", "badge_counts_updated", "thread_marked"],
  });
  ctx.add("realtime.handler", {
    run: store.requestActivityRefresh,
    types: ["activity_mark_all_read_completed", "activity_views_updated"],
  });
  ctx.add(
    "sidebar.nav",
    { button: ActivityButton, feed: true, id: "activity", label: "Activity", view: ActivityView },
    { order: 10 },
  );
};

export default setup;
