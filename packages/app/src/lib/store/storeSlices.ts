import type { Bootstrap, DirectMessage, UserPrefs } from "@slock/slack-api";
import type { Resource } from "solid-js";
import { createCanvasSlice } from "./slices/entities/canvas";
import { createChannelsSlice } from "./slices/entities/channels";
import { createDmsSlice } from "./slices/entities/dms";
import { createPinnedSlice } from "./slices/entities/pinned";
import { createUsergroupsSlice } from "./slices/entities/usergroups";
import { createUsersSlice } from "./slices/entities/users";
import { createActivitySlice } from "./slices/messaging/activity";
import { createMessagesSlice } from "./slices/messaging/messages";
import { createRealtimeSlice } from "./slices/messaging/realtime";
import { createTypingSlice } from "./slices/messaging/typing";
import { createUnreadSlice } from "./slices/messaging/unread";
import { createChannelTabsSlice } from "./slices/session/channelTabs";
import { createCommandsSlice } from "./slices/session/commands";
import { createDesktopNotificationsSlice } from "./slices/session/desktopNotifications";
import { createLaterSlice } from "./slices/session/later";
import { createModalsSlice } from "./slices/session/modals";
import { createPreferencesSlice } from "./slices/session/preferences";
import { createSearchHistorySlice } from "./slices/session/searchHistory";
import { createViewStateSlice } from "./slices/session/viewState";
import type { View } from "./slices/types";

export function createStoreSlices({
  bootstrap,
  userPrefs,
}: {
  bootstrap: Resource<Bootstrap>;
  userPrefs: Resource<UserPrefs>;
}) {
  const viewState = createViewStateSlice({ bootstrap });
  const users = createUsersSlice({ currentUserBase: () => bootstrap()?.currentUser });
  const usergroups = createUsergroupsSlice({ currentUser: users.currentUser });
  const typing = createTypingSlice({ userById: users.userById });
  const setActiveViewImplRef: { current: (view: View) => void } = { current: () => {} };
  const setActiveView = (view: View) => setActiveViewImplRef.current(view);
  // dms.patchDm doesn't exist yet when the unread slice is built (dms needs
  // unread.unreadChannelIds, so it must come later) — bridge with a stable
  // wrapper, filled in once dms is created below.
  const patchDmImplRef: { current: (id: string, patch: Partial<DirectMessage>) => void } = {
    current: () => {},
  };
  const patchDm = (id: string, patch: Partial<DirectMessage>) => patchDmImplRef.current(id, patch);
  const channels = createChannelsSlice({
    activeView: viewState.activeView,
    bootstrap,
    setActiveView,
  });
  const preferences = createPreferencesSlice({
    channels: channels.channels,
    userPrefs,
  });
  const unread = createUnreadSlice({ bootstrap, patchChannel: channels.patchChannel, patchDm });
  const activity = createActivitySlice({
    currentUser: users.currentUser,
    lastReadByChannel: unread.lastReadByChannel,
    patchChannel: channels.patchChannel,
    patchDm,
    setLastReadByChannel: unread.setLastReadByChannel,
  });
  const desktopNotifications = createDesktopNotificationsSlice({ userPrefs });
  const searchHistory = createSearchHistorySlice({ userPrefs });
  const channelTabsSlice = createChannelTabsSlice({ userPrefs });
  const later = createLaterSlice();
  const dms = createDmsSlice({
    activeView: viewState.activeView,
    bootstrap,
    closeUserProfile: users.closeUserProfile,
    removeDmFromSidebar: channels.removeDmFromSidebar,
    removeDmsFromSidebar: channels.removeDmsFromSidebar,
    setActiveView,
    unreadChannelIds: unread.unreadChannelIds,
  });
  patchDmImplRef.current = dms.patchDm;
  const pinned = createPinnedSlice();
  const canvas = createCanvasSlice();
  const modals = createModalsSlice();
  const messages = createMessagesSlice({
    activeThread: viewState.activeThread,
    activeView: viewState.activeView,
    clearChannelUnread: unread.clearChannelUnread,
    currentUser: users.currentUser,
    pushActivity: activity.pushActivity,
    recordActivityEngagement: activity.recordActivityEngagement,
    setLastReadByChannel: unread.setLastReadByChannel,
    setUnreadChannelIds: unread.setUnreadChannelIds,
    setUnreadDividerTs: unread.setUnreadDividerTs,
  });
  const realtime = createRealtimeSlice({
    activeThread: viewState.activeThread,
    activeView: viewState.activeView,
    allDirectMessages: dms.allDirectMessages,
    applyReactionEvent: messages.applyReactionEvent,
    channels: channels.channels,
    clearTyping: typing.clearTyping,
    closedDmIds: dms.closedDmIds,
    currentUser: users.currentUser,
    ensureDm: dms.ensureDm,
    findAllMessageLocations: messages.findAllMessageLocations,
    insertMessageInOrder: messages.insertMessageInOrder,
    invalidateUser: users.invalidateUser,
    isChannelNotifyAll: preferences.isChannelNotifyAll,
    loadedChannels: messages.loadedChannels,
    loadedThreads: messages.loadedThreads,
    matchingHighlightWord: preferences.matchingHighlightWord,
    mergeIncomingMessage: messages.mergeIncomingMessage,
    messagesByChannel: messages.messagesByChannel,
    openModalView: modals.openView,
    patchChannel: channels.patchChannel,
    patchDm: dms.patchDm,
    patchMessage: messages.patchMessage,
    pushActivity: activity.pushActivity,
    recordActivityEngagement: activity.recordActivityEngagement,
    recordTyping: typing.recordTyping,
    setGatewayActivityBadgeCounts: activity.setGatewayActivityBadgeCounts,
    setClosedDmIds: dms.setClosedDmIds,
    setDmLastActivity: dms.setDmLastActivity,
    setLastReadByChannel: unread.setLastReadByChannel,
    setMessagesByChannel: messages.setMessagesByChannel,
    setPresenceOverrides: users.setPresenceOverrides,
    setThreadMessages: messages.setThreadMessages,
    setUnreadChannelIds: unread.setUnreadChannelIds,
    threadMessages: messages.threadMessages,
  });
  const commands = createCommandsSlice({ sendMessage: messages.sendMessage });
  return {
    activity,
    canvas,
    channels,
    channelTabsSlice,
    commands,
    desktopNotifications,
    dms,
    later,
    messages,
    modals,
    pinned,
    preferences,
    realtime,
    searchHistory,
    setActiveView,
    setActiveViewImplRef,
    typing,
    unread,
    users,
    usergroups,
    viewState,
  };
}
