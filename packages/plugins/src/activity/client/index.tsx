import { EmojiText } from "@slock/blockkit";
import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { Icon } from "@slock/ui";
import { createEffect, lazy, Show, untrack } from "solid-js";
import { createReactionCache } from "./reactionCache";
import { createActivityStore } from "./store";

const ActivityView = lazy(() => import("./views/ActivityView"));

function ActivityButton() {
  const activity = service("activity");
  return (
    <span class="sidebar-nav-btn-icon flex-center hover-hl">
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
        <span class="sidebar-ping-dot" classList={{ "has-count": activity.unreadPingCount() > 0 }}>
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
  const store = createActivityStore({
    cacheResolvedMessages: createReactionCache(messages),
    clearChannelUnread: unread.clearChannelUnread,
    currentUser: users.currentUser,
    isBotUser: (userId) => !!users.userById(userId)?.isBot,
    isViewed: unread.isViewed,
    lastReadByChannel: unread.lastReadByChannel,
    reactionMessageFor: messages.reactionMessageFor,
    setLastReadByChannel: unread.setLastReadByChannel,
    syncChannelRead: unread.syncChannelRead,
    syncThreadRead: unread.syncThreadRead,
    visibleThreads: messages.visibleThreads,
  });
  ctx.provide("activity", store);
  const bootstrap = service("bootstrap");
  const prefs = service("prefs");
  createEffect(() => {
    const preferencesSettled = prefs.preferencesReady() || !!bootstrap.userPrefs.error;
    if (users.currentUser() && preferencesSettled) void untrack(() => store.ensureActivityLoaded());
  });
  createEffect(() => store.setGatewayActivityBadgeCounts(bootstrap.bootstrap.data?.activityCounts));
  ctx.add("unread.counts", (notifications) => {
    if (store.setGatewayActivityBadgeCounts(notifications)) store.requestActivityRefresh();
  });
  ctx.add("messages.deleted", store.removeActivityForMessage);
  ctx.add("realtime.handler", {
    run: (event) => {
      if (
        event.type === "badge_counts_updated" &&
        store.setGatewayActivityBadgeCounts(event.activity_v2)
      )
        store.requestActivityRefresh();
      if (
        event.type === "thread_marked" &&
        event.thread_ts &&
        typeof event.unread_count === "number"
      )
        store.applyThreadMarked(event.thread_ts, event.unread_count);
    },
    types: ["badge_counts_updated", "thread_marked"],
  });
  ctx.add(
    "sidebar.nav",
    { button: ActivityButton, feed: true, id: "activity", label: "Activity", view: ActivityView },
    { order: 10 },
  );
};

export default setup;
