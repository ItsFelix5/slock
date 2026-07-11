import type { Channel, MessageShortcut } from "@slock/slack-api";
import {
  fetchBootstrap,
  fetchMessageShortcuts,
  fetchProfileFieldDefs,
  markChannelRead,
  runMessageShortcut,
} from "@slock/slack-api";
import { createEffect, createResource, createRoot } from "solid-js";
import { EMPTY_FILTERS, type SearchFilters } from "../searchQuery";
import { createCanvasSlice } from "./slices/entities/canvas";
import { createChannelsSlice } from "./slices/entities/channels";
import { createDmsSlice } from "./slices/entities/dms";
import { createPinnedSlice } from "./slices/entities/pinned";
import { createUsersSlice } from "./slices/entities/users";
import { actionFeedback } from "./slices/feedback";
import { createActivitySlice } from "./slices/messaging/activity";
import { createMessagesSlice } from "./slices/messaging/messages";
import { createRealtimeSlice } from "./slices/messaging/realtime";
import { createTypingSlice } from "./slices/messaging/typing";
import { createUnreadSlice } from "./slices/messaging/unread";
import { createCommandsSlice } from "./slices/session/commands";
import { createDesktopNotificationsSlice } from "./slices/session/desktopNotifications";
import { createLaterSlice } from "./slices/session/later";
import { createPreferencesSlice } from "./slices/session/preferences";
import { createUsageSlice } from "./slices/session/usage";
import { createViewStateSlice } from "./slices/session/viewState";
import type { Nav, View } from "./slices/types";

export { actionFeedback } from "./slices/feedback";
export { isPingingActivity } from "./slices/messaging/activity";
export { REMINDER_OPTIONS } from "./slices/messaging/messages";
export type { MessageLocation, Nav, ThreadRef, View } from "./slices/types";

function setup() {
  const [bootstrap] = createResource(fetchBootstrap);
  const [messageShortcuts] = createResource(fetchMessageShortcuts);
  const [profileFieldDefs] = createResource(fetchProfileFieldDefs);

  async function runMessageShortcutAt(
    channelId: string,
    ts: string,
    shortcut: Pick<MessageShortcut, "actionId" | "appId" | "appName">,
  ) {
    try {
      await runMessageShortcut(shortcut.actionId, shortcut.appId, channelId, ts);
    } catch (err) {
      actionFeedback.flash(
        ts,
        err instanceof Error ? err.message : `Failed to run ${shortcut.appName}.`,
        "error",
      );
    }
  }

  const viewState = createViewStateSlice({ bootstrap });
  const users = createUsersSlice({ currentUserBase: () => bootstrap()?.currentUser });
  const typing = createTypingSlice({ userById: users.userById });
  const usage = createUsageSlice();

  // channels.ts and dms.ts both need to be able to *switch the active view*
  // (join/leave a channel, open/close a DM) — but the actual setActiveView
  // (below) needs both of those slices already built to clear their unread
  // state. This indirection breaks that cycle: the slices call the stable
  // `setActiveView` wrapper, which only starts forwarding to the real
  // implementation once it's assigned further down — always well before any
  // user interaction can invoke it.
  let setActiveViewImpl: (view: View) => void = () => {};
  const setActiveView = (view: View) => setActiveViewImpl(view);

  const channels = createChannelsSlice({
    bootstrap,
    activeView: viewState.activeView,
    setActiveView,
  });
  const preferences = createPreferencesSlice({
    channels: channels.channels,
    userPrefs: usage.userPrefs,
  });
  const unread = createUnreadSlice({ patchChannel: channels.patchChannel });
  const activity = createActivitySlice({
    currentUser: users.currentUser,
    lastReadByChannel: unread.lastReadByChannel,
    setLastReadByChannel: unread.setLastReadByChannel,
    patchChannel: channels.patchChannel,
  });
  const desktopNotifications = createDesktopNotificationsSlice();
  const later = createLaterSlice();
  const dms = createDmsSlice({
    bootstrap,
    closeUserProfile: users.closeUserProfile,
    unreadChannelIds: unread.unreadChannelIds,
    activeView: viewState.activeView,
    setActiveView,
  });
  const pinned = createPinnedSlice();
  const canvas = createCanvasSlice();
  const messages = createMessagesSlice({
    currentUser: users.currentUser,
    pushActivity: activity.pushActivity,
    clearChannelUnread: unread.clearChannelUnread,
    setLastReadByChannel: unread.setLastReadByChannel,
    setUnreadDividerTs: unread.setUnreadDividerTs,
    setUnreadChannelIds: unread.setUnreadChannelIds,
    activeView: viewState.activeView,
    activeThread: viewState.activeThread,
  });
  const realtime = createRealtimeSlice({
    activeView: viewState.activeView,
    activeThread: viewState.activeThread,
    currentUser: users.currentUser,
    channels: channels.channels,
    patchChannel: channels.patchChannel,
    setUnreadChannelIds: unread.setUnreadChannelIds,
    setPresenceOverrides: users.setPresenceOverrides,
    invalidateUser: users.invalidateUser,
    recordTyping: typing.recordTyping,
    allDirectMessages: dms.allDirectMessages,
    setDmLastActivity: dms.setDmLastActivity,
    closedDmIds: dms.closedDmIds,
    setClosedDmIds: dms.setClosedDmIds,
    isChannelNotifyAll: preferences.isChannelNotifyAll,
    matchingHighlightWord: preferences.matchingHighlightWord,
    pushActivity: activity.pushActivity,
    messagesByChannel: messages.messagesByChannel,
    setMessagesByChannel: messages.setMessagesByChannel,
    threadMessages: messages.threadMessages,
    setThreadMessages: messages.setThreadMessages,
    loadedChannels: messages.loadedChannels,
    loadedThreads: messages.loadedThreads,
    findAllMessageLocations: messages.findAllMessageLocations,
    patchMessage: messages.patchMessage,
    insertMessageInOrder: messages.insertMessageInOrder,
    mergeIncomingMessage: messages.mergeIncomingMessage,
    applyReactionEvent: messages.applyReactionEvent,
  });
  const commands = createCommandsSlice({ sendMessage: messages.sendMessage });

  // ---- composed actions: switching views has side effects across several ----
  // ---- slices (unread, frecency, DM re-opening, the realtime watch set) ----

  setActiveViewImpl = (view: View) => {
    viewState.setActiveThread(null);
    viewState.setSelected(view);
    viewState.setNav("home");
    unread.clearChannelUnread(view.id);
    if (view.kind === "dm" && dms.closedDmIds[view.id]) dms.setClosedDmIds(view.id, false);
    const frecencyId =
      view.kind === "dm"
        ? (dms.allDirectMessages().find((d) => d.id === view.id)?.userId ?? view.id)
        : view.id;
    usage.recordVisit(frecencyId);
  };

  function setNavView(next: Nav) {
    viewState.setNav(next);
    if (next === "later") later.ensureLaterLoaded();
    if (next === "activity") activity.ensureActivityLoaded();
  }

  function openThread(channelId: string, ts: string) {
    viewState.setActiveThread({ channelId, ts });
  }

  function closeThread() {
    const thread = viewState.activeThread();
    if (thread) realtime.send({ type: "unwatch_thread", ts: thread.ts });
    viewState.setActiveThread(null);
  }

  // Opens a channel/message from the Activity or Later list without leaving that
  // tab — nav stays on 'activity'/'later' (so the feed keeps showing in the
  // sidebar) while the main panel switches to the selected channel.
  function openChannelPeek(channelId: string, ts: string) {
    viewState.setSelected({ kind: "channel", id: channelId });
    unread.clearChannelUnread(channelId);
    usage.recordVisit(channelId);
    openThread(channelId, ts);
  }

  function openMessageSearch(query: string, filters: SearchFilters = EMPTY_FILTERS) {
    viewState.setSearchScreenQuery(query);
    viewState.setSearchScreenFilters(filters);
    setNavView("search");
  }

  async function markAllAsRead() {
    const nowMs = Date.now();
    const now = String(nowMs / 1000);
    const targets = [
      ...channels
        .channels()
        .filter((c) => !channels.isChannelLeft(c.id))
        .map((c) => c.id),
      ...dms.directMessages().map((d) => d.id),
    ];
    for (const id of targets) {
      unread.clearChannelUnread(id);
      unread.setLastReadByChannel(id, nowMs);
      markChannelRead(id, now).catch(() => {});
    }
  }

  // ---- cross-slice reactive wiring ----

  createEffect(() => {
    const view = viewState.activeView();
    if (view) pinned.ensurePinsLoaded(view.id);
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
    activityItems: activity.activityItems,
    userById: users.userById,
    channelById: channels.channelById,
    channelDisplayName,
    isChannelMuted: preferences.isChannelMuted,
    isDndActive: preferences.isDndActive,
    activeView: viewState.activeView,
    openChannelPeek,
  });

  return {
    bootstrap,
    sections: channels.sections,
    messageShortcuts,
    runMessageShortcutAt,
    profileFieldDefs,
    directMessages: dms.directMessages,
    nav: viewState.nav,
    setNavView,
    searchScreenQuery: viewState.searchScreenQuery,
    searchScreenFilters: viewState.searchScreenFilters,
    openMessageSearch,
    activeView: viewState.activeView,
    setActiveView,
    openChannelPeek,
    frecencyScore: usage.frecencyScore,
    recordEmojiUse: usage.recordEmojiUse,
    emojiUseScore: usage.emojiUseScore,
    messagesByChannel: messages.messagesByChannel,
    loadOlderMessages: messages.loadOlderMessages,
    hasMoreHistory: messages.hasMoreHistory,
    isLoadingHistory: messages.isLoadingHistory,
    activeThread: viewState.activeThread,
    threadMessages: messages.threadMessages,
    openThread,
    closeThread,
    userById: users.userById,
    knownUsers: users.knownUsers,
    searchUsers: users.searchUsers,
    channelById: channels.channelById,
    patchChannel: channels.patchChannel,
    isChannelMember: channels.isChannelMember,
    dmById: dms.dmById,
    dmIdForUser: dms.dmIdForUser,
    currentUser: users.currentUser,
    sendMessage: messages.sendMessage,
    editMessageText: messages.editMessageText,
    broadcastThreadReply: messages.broadcastThreadReply,
    deleteMessageAt: messages.deleteMessageAt,
    reactToMessage: messages.reactToMessage,
    isThreadSubscribed: messages.isThreadSubscribed,
    toggleThreadSubscribed: messages.toggleThreadSubscribed,
    isSavedForLater: later.isSavedForLater,
    toggleSaveForLater: later.toggleSaveForLater,
    laterItems: later.laterItems,
    laterMessages: later.laterMessages,
    ensureLaterLoaded: later.ensureLaterLoaded,
    ensureLaterMessageLoaded: later.ensureLaterMessageLoaded,
    activityItems: activity.activityItems,
    ensureActivityLoaded: activity.ensureActivityLoaded,
    unreadActivityCount: activity.unreadActivityCount,
    hasUnreadPing: activity.hasUnreadPing,
    hasUnreadGlow: activity.hasUnreadGlow,
    markActivityRead: activity.markActivityRead,
    markActivityItemRead: activity.markActivityItemRead,
    isActivityItemUnread: activity.isActivityItemUnread,
    profileUserId: users.profileUserId,
    openUserProfile: users.openUserProfile,
    closeUserProfile: users.closeUserProfile,
    openDmWithUser: dms.openDmWithUser,
    closeDmConversation: dms.closeDmConversation,
    rtmConnected: realtime.rtmConnected,
    unreadChannelIds: unread.unreadChannelIds,
    isChannelStarred: channels.isChannelStarred,
    toggleChannelStar: channels.toggleChannelStar,
    isChannelLeft: channels.isChannelLeft,
    leaveCurrentChannel: channels.leaveCurrentChannel,
    markCurrentChannelRead: messages.markCurrentChannelRead,
    isMessagePinned: pinned.isMessagePinned,
    togglePinMessage: pinned.togglePinMessage,
    copyMessageLink: messages.copyMessageLink,
    prepareReplyLink: messages.prepareReplyLink,
    markMessageUnread: messages.markMessageUnread,
    remindAboutMessage: messages.remindAboutMessage,
    unreadDividerTsForChannel: unread.unreadDividerTsForChannel,
    channels: channels.channels,
    pinnedPanelChannelId: pinned.pinnedPanelChannelId,
    pinnedMessagesCache: pinned.pinnedMessagesCache,
    openPinnedPanel: pinned.openPinnedPanel,
    closePinnedPanel: pinned.closePinnedPanel,
    browsableChannels: channels.browsableChannels,
    searchBrowsableChannels: channels.searchBrowsableChannels,
    joinChannelById: channels.joinChannelById,
    updateMyStatus: users.updateMyStatus,
    clearMyStatus: users.clearMyStatus,
    updateMyProfile: users.updateMyProfile,
    updateMyPresence: users.updateMyPresence,
    isChannelMuted: preferences.isChannelMuted,
    toggleMuteChannel: preferences.toggleMuteChannel,
    isChannelNotifyAll: preferences.isChannelNotifyAll,
    toggleNotifyAllChannel: preferences.toggleNotifyAllChannel,
    mutedChannels: preferences.mutedChannels,
    notifyAllChannels: preferences.notifyAllChannels,
    highlightWords: preferences.highlightWords,
    addHighlightWord: preferences.addHighlightWord,
    removeHighlightWord: preferences.removeHighlightWord,
    createChannelSection: channels.createChannelSection,
    renameChannelSection: channels.renameChannelSection,
    deleteChannelSection: channels.deleteChannelSection,
    moveChannelToSection: channels.moveChannelToSection,
    isDndActive: preferences.isDndActive,
    dndSnoozedUntil: preferences.dndSnoozedUntil,
    snoozeDnd: preferences.snoozeDnd,
    endDnd: preferences.endDnd,
    markAllAsRead,
    canvasByChannel: canvas.canvasByChannel,
    ensureCanvasChecked: canvas.ensureCanvasChecked,
    openCanvasChannelId: canvas.openCanvasChannelId,
    openChannelCanvas: canvas.openChannelCanvas,
    closeChannelCanvas: canvas.closeChannelCanvas,
    createCanvasForCurrentChannel: canvas.createCanvasForCurrentChannel,
    loadCanvasContent: canvas.loadCanvasContent,
    saveChannelCanvas: canvas.saveChannelCanvas,
    handleSlashCommand: commands.handleSlashCommand,
    typingUsersInChannel: typing.typingUsersInChannel,
    typingUsersInThread: typing.typingUsersInThread,
    desktopNotificationsSupported: desktopNotifications.supported,
    desktopNotificationPermission: desktopNotifications.permission,
    desktopNotificationsEnabled: desktopNotifications.enabled,
    requestDesktopNotificationPermission: desktopNotifications.requestPermission,
    setDesktopNotificationsEnabled: desktopNotifications.setNotificationsEnabled,
  };
}

export const {
  bootstrap,
  sections,
  messageShortcuts,
  runMessageShortcutAt,
  profileFieldDefs,
  directMessages,
  nav,
  setNavView,
  searchScreenQuery,
  searchScreenFilters,
  openMessageSearch,
  activeView,
  setActiveView,
  openChannelPeek,
  frecencyScore,
  recordEmojiUse,
  emojiUseScore,
  messagesByChannel,
  loadOlderMessages,
  hasMoreHistory,
  isLoadingHistory,
  activeThread,
  threadMessages,
  openThread,
  closeThread,
  userById,
  knownUsers,
  searchUsers,
  channelById,
  patchChannel,
  isChannelMember,
  dmById,
  dmIdForUser,
  currentUser,
  sendMessage,
  editMessageText,
  broadcastThreadReply,
  deleteMessageAt,
  reactToMessage,
  isThreadSubscribed,
  toggleThreadSubscribed,
  isSavedForLater,
  toggleSaveForLater,
  laterItems,
  laterMessages,
  ensureLaterLoaded,
  ensureLaterMessageLoaded,
  activityItems,
  ensureActivityLoaded,
  unreadActivityCount,
  hasUnreadPing,
  hasUnreadGlow,
  markActivityRead,
  markActivityItemRead,
  isActivityItemUnread,
  profileUserId,
  openUserProfile,
  closeUserProfile,
  openDmWithUser,
  closeDmConversation,
  rtmConnected,
  unreadChannelIds,
  isChannelStarred,
  toggleChannelStar,
  isChannelLeft,
  leaveCurrentChannel,
  markCurrentChannelRead,
  isMessagePinned,
  togglePinMessage,
  copyMessageLink,
  prepareReplyLink,
  markMessageUnread,
  remindAboutMessage,
  unreadDividerTsForChannel,
  channels,
  pinnedPanelChannelId,
  pinnedMessagesCache,
  openPinnedPanel,
  closePinnedPanel,
  browsableChannels,
  searchBrowsableChannels,
  joinChannelById,
  updateMyStatus,
  clearMyStatus,
  updateMyProfile,
  updateMyPresence,
  isChannelMuted,
  toggleMuteChannel,
  isChannelNotifyAll,
  toggleNotifyAllChannel,
  mutedChannels,
  notifyAllChannels,
  highlightWords,
  addHighlightWord,
  removeHighlightWord,
  createChannelSection,
  renameChannelSection,
  deleteChannelSection,
  moveChannelToSection,
  isDndActive,
  dndSnoozedUntil,
  snoozeDnd,
  endDnd,
  markAllAsRead,
  canvasByChannel,
  ensureCanvasChecked,
  openCanvasChannelId,
  openChannelCanvas,
  closeChannelCanvas,
  createCanvasForCurrentChannel,
  loadCanvasContent,
  saveChannelCanvas,
  handleSlashCommand,
  typingUsersInChannel,
  typingUsersInThread,
  desktopNotificationsSupported,
  desktopNotificationPermission,
  desktopNotificationsEnabled,
  requestDesktopNotificationPermission,
  setDesktopNotificationsEnabled,
} = createRoot(setup);

// Some channels arrive without a human-readable name (shared/external channels,
// or ones we can only see by id) — channelById already kicks off a background
// Flaron lookup for those, but this covers the gap before it resolves (or if
// Flaron doesn't know the id either). Fall back to a shareable Flaron permalink
// for public channels, and to the bare id only when even that wouldn't resolve
// (private channels we can't publicly link).
export function channelDisplayName(
  channel: Pick<Channel, "id" | "name" | "private"> | undefined,
  fallbackId?: string,
): string {
  const name = channel?.name?.trim();
  if (name) return name;
  const id = channel?.id ?? fallbackId ?? "";
  return id;
}
