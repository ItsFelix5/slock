import { createEffect } from "solid-js";
import type { Bootstrap, DirectMessage, UserPrefs } from "../api";
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
import { createCommandsSlice } from "./slices/session/commands";
import { createDesktopNotificationsSlice } from "./slices/session/desktopNotifications";
import { createLaterSlice } from "./slices/session/later";
import { createModalsSlice } from "./slices/session/modals";
import { createPanesSlice } from "./slices/session/panes";
import { createPreferencesSlice } from "./slices/session/preferences";
import { createSearchHistorySlice } from "./slices/session/searchHistory";
import { createViewStateSlice } from "./slices/session/viewState";
import type { View } from "./slices/types";

export function createStoreSlices({
  bootstrap,
  userPrefs,
  mutateUserPrefs,
}: {
  bootstrap: () => Bootstrap | undefined;
  userPrefs: () => UserPrefs | undefined;
  mutateUserPrefs: (updater: (current: UserPrefs | undefined) => UserPrefs | undefined) => void;
}) {
  const panes = createPanesSlice();
  const viewState = createViewStateSlice({ bootstrap, panes });
  const { visibleMessageTargets, visibleThreads, visibleViews } = panes;

  const isSelfOnlineImplRef: { current: () => boolean } = {
    current: () => true,
  };
  const users = createUsersSlice({
    currentUserBase: () => bootstrap()?.currentUser,
    isSelfOnline: () => isSelfOnlineImplRef.current(),
    panes,
  });
  const usergroups = createUsergroupsSlice({
    allUsergroupIds: () => bootstrap()?.allUsergroupIds ?? [],
    selfUsergroupIds: () => bootstrap()?.selfUsergroupIds ?? [],
  });
  const typing = createTypingSlice({ userById: users.userById });
  const setActiveViewImplRef: {
    current: (view: View, options?: { autofocus?: boolean }) => void;
  } = {
    current: () => {},
  };
  const setActiveView = (view: View, options?: { autofocus?: boolean }) =>
    setActiveViewImplRef.current(view, options);

  const patchDmImplRef: {
    current: (id: string, patch: Partial<DirectMessage>) => void;
  } = {
    current: () => {},
  };
  const desktopNotificationImplRef: { current: (payload: any) => void } = {
    current: () => {},
  };
  const patchDm = (id: string, patch: Partial<DirectMessage>) => patchDmImplRef.current(id, patch);
  const channels = createChannelsSlice({
    activeView: viewState.activeView,
    bootstrap,
    nav: viewState.nav,
    setActiveView,
    userPrefs,
    mutateUserPrefs,
  });
  const preferences = createPreferencesSlice({
    channels: channels.channels,
    userPrefs,
  });
  const unread = createUnreadSlice({
    bootstrap,
    patchChannel: channels.patchChannel,
    patchDm,
  });
  const cacheResolvedMessagesRef: {
    current: (messages: Map<string, import("../api").Message>) => void;
  } = { current: () => {} };
  const reactionMessageForRef: {
    current: (channelId: string, ts: string) => import("../api").Message | undefined;
  } = { current: () => undefined };
  const activity = createActivitySlice({
    cacheResolvedMessages: (messages) => cacheResolvedMessagesRef.current(messages),
    clearChannelUnread: unread.clearChannelUnread,
    currentUser: users.currentUser,
    isBotUser: (userId) => !!users.userById(userId)?.isBot,
    lastReadByChannel: unread.lastReadByChannel,
    reactionMessageFor: (channelId, ts) => reactionMessageForRef.current(channelId, ts),
    setLastReadByChannel: unread.setLastReadByChannel,
    syncChannelRead: unread.syncChannelRead,
    syncThreadRead: unread.syncThreadRead,
    visibleThreads,
  });
  createEffect(() => activity.setGatewayActivityBadgeCounts(bootstrap()?.activityCounts));
  const desktopNotifications = createDesktopNotificationsSlice({ userPrefs });
  const searchHistory = createSearchHistorySlice();
  const later = createLaterSlice();
  const dms = createDmsSlice({
    activeView: viewState.activeView,
    bootstrap,
    closeUserProfile: users.closeUserProfile,
    currentUser: users.currentUser,
    openInPane: panes.openInNewPane,
    setActiveView,
  });
  patchDmImplRef.current = dms.patchDm;
  const pinned = createPinnedSlice({ panes });
  const canvas = createCanvasSlice({ panes });
  const modals = createModalsSlice();
  const messages = createMessagesSlice({
    clearChannelUnread: unread.clearChannelUnread,
    currentUser: users.currentUser,
    onConversationView: (view) => {
      channels.patchChannel(view.channel.id, view.channel);
      users.cacheUsers(view.users);
    },
    pushActivity: activity.pushActivity,
    setLastReadByChannel: unread.setLastReadByChannel,
    setChannelRead: unread.setChannelRead,
    setThreadRead: unread.setThreadRead,
    setUnreadChannelIds: unread.setUnreadChannelIds,
    setUnreadDividerTs: unread.setUnreadDividerTs,
    syncChannelRead: unread.syncChannelRead,
    visibleMessageTargets,
    visibleThreads,
    visibleViews,
  });
  cacheResolvedMessagesRef.current = (resolved) => {
    for (const [key, message] of resolved) messages.setReactionMessages(key, [message]);
  };
  reactionMessageForRef.current = messages.reactionMessageFor;
  const realtime = createRealtimeSlice({
    addJoinedChannel: channels.addJoinedChannel,
    allDirectMessages: dms.allDirectMessages,
    dmById: dms.dmById,
    applyDndSnoozeEvent: preferences.applyDndSnoozeEvent,
    applyPinEvent: pinned.applyPinEvent,
    applyReactionEvent: messages.realtimeHooks.applyReactionEvent,
    applySavedEvent: later.applySavedEvent,
    applyThreadMarked: activity.applyThreadMarked,
    channels: channels.channels,
    isChannelMember: channels.isChannelMember,
    clearTyping: typing.clearTyping,
    closedDmIds: dms.closedDmIds,
    currentUser: users.currentUser,
    ensureDm: dms.ensureDm,
    ensureMpdm: dms.ensureMpdm,
    findAllMessageLocations: messages.findAllMessageLocations,
    handleCanvasCreated: canvas.handleCanvasCreated,
    insertMessageInOrder: messages.realtimeHooks.insertMessageInOrder,
    invalidateUser: users.invalidateUser,
    invalidateUsergroup: usergroups.invalidateUsergroup,
    isThreadKnown: messages.isThreadKnown,
    loadedChannels: messages.loadedChannels,
    loadRecentHistory: messages.loadRecentHistory,
    refreshThreadReplies: messages.refreshThreadReplies,
    markChannelLeft: channels.markChannelLeft,
    mergeIncomingMessage: messages.realtimeHooks.mergeIncomingMessage,
    messagesByChannel: messages.messagesByChannel,
    openModalView: modals.openView,
    patchChannel: channels.patchChannel,
    patchDm: dms.patchDm,
    patchMessage: messages.patchMessage,
    recordTyping: typing.recordTyping,
    refreshActivityFeed: activity.requestActivityRefresh,
    setChannelStarred: channels.setStarredChannelIds,
    setGatewayActivityBadgeCounts: activity.setGatewayActivityBadgeCounts,
    setClosedDmIds: dms.setClosedDmIds,
    setLastReadByChannel: unread.setLastReadByChannel,
    setMessagesByChannel: messages.setMessagesByChannel,
    setPresenceOverrides: users.setPresenceOverrides,
    setThreadMessages: messages.setThreadMessages,
    setUnreadChannelIds: unread.setUnreadChannelIds,
    showGatewayNotification: (payload) => desktopNotificationImplRef.current(payload),
    threadMessages: messages.threadMessages,
    updateModalView: modals.updateView,
    visibleThreads,
    visibleViews,
  });
  isSelfOnlineImplRef.current = realtime.isSelfOnline;
  const commands = createCommandsSlice({ sendMessage: messages.sendMessage });
  return {
    activity,
    canvas,
    channels,
    commands,
    desktopNotifications,
    desktopNotificationImplRef,
    dms,
    later,
    messages,
    modals,
    panes,
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
    visibleMessageTargets,
    visibleThreads,
    visibleViews,
  };
}
