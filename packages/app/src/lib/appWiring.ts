import { createEffect } from "solid-js";
import type { createAppActions } from "./appActions";
import { createMarkAllAsRead } from "./store/markAllAsRead";
import { channelDisplayName } from "./store/slices/channelDisplayName";
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
> & {
  actions: ReturnType<typeof createAppActions>;
};

/** Installs cross-domain reactive behavior after all slices have been composed. */
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
  } = deps;
  const markAllAsRead = createMarkAllAsRead({
    channelIds: () =>
      channels
        .channels()
        .filter((channel) => !channels.isChannelLeft(channel.id))
        .map((channel) => channel.id),
    clearUnread: unread.clearChannelUnread,
    dmIds: () => dms.directMessages().map((dm) => dm.id),
    setLastRead: unread.setLastReadByChannel,
  });

  createEffect(() => {
    const view = viewState.activeView();
    if (view) void pinned.ensurePinsLoaded(view.id);
  });
  let wasOnActivity = false;
  createEffect(() => {
    const isActivity = viewState.nav() === "activity";
    if (wasOnActivity && !isActivity) activity.markActivityRead();
    wasOnActivity = isActivity;
  });
  unread.wireReadTracking({
    activeView: viewState.activeView,
    messagesByChannel: messages.messagesByChannel,
  });
  desktopNotifications.wireNotifications({
    activeView: viewState.activeView,
    activityItems: activity.activityItems,
    channelById: channels.channelById,
    channelDisplayName,
    isChannelMuted: preferences.isChannelMuted,
    isDndActive: preferences.isDndActive,
    openChannelPeek: actions.openChannelPeek,
    userById: users.userById,
  });
  return { markAllAsRead };
}
