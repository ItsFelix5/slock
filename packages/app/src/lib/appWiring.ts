import { createEffect } from "solid-js";
import type { createAppActions } from "./appActions";
import { createMarkAllAsRead } from "./store/markAllAsRead";
import type { createStoreSlices } from "./store/storeSlices";

type AppWiringDeps = Pick<
  ReturnType<typeof createStoreSlices>,
  | "activity"
  | "channels"
  | "desktopNotifications"
  | "dms"
  | "messages"
  | "pinned"
  | "preferences"
  | "unread"
  | "users"
  | "viewState"
  | "visibleThreads"
  | "visibleViews"
> & {
  actions: ReturnType<typeof createAppActions>;
};

export function wireAppState(deps: AppWiringDeps) {
  const {
    actions,
    activity,
    channels,
    desktopNotifications,
    dms,
    messages,
    pinned,
    preferences,
    unread,
    users,
    viewState,
    visibleThreads,
    visibleViews,
  } = deps;
  const markAllAsRead = createMarkAllAsRead({
    channelIds: () =>
      channels
        .channels()
        .filter((channel) => !channels.isChannelLeft(channel.id))
        .map((channel) => channel.id),
    clearUnread: unread.clearChannelUnread,
    dmIds: () => dms.directMessages().map((dm) => dm.id),
    setChannelRead: unread.setChannelRead,
    setLastRead: unread.setLastReadByChannel,
  });

  createEffect(() => {
    const view = viewState.activeView();
    if (view) void pinned.ensurePinsLoaded(view.id);
  });
  unread.wireReadTracking({
    messagesByChannel: messages.messagesByChannel,
    threadMessages: messages.threadMessages,
    visibleThreads,
    visibleViews,
  });
  desktopNotifications.wireNotifications({
    activeView: viewState.activeView,
    activityItems: activity.activityItems,
    channelById: channels.channelById,
    dmById: dms.dmById,
    isChannelMuted: preferences.isChannelMuted,
    isDndActive: preferences.isDndActive,
    openChannelPeek: actions.openChannelPeek,
    userById: users.userById,
  });
  return { markAllAsRead };
}
