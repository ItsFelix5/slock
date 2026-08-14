import {
  fetchBootstrap,
  fetchMessageShortcuts,
  fetchProfileFieldDefs,
  fetchUserPrefs,
} from "@slock/slack-api";
import { createResource, createRoot, createSignal } from "solid-js";
import { createAppActions } from "../appActions";
import { wireAppState } from "../appWiring";
import { createRunMessageShortcut } from "./runMessageShortcut";
import { createStoreSlices } from "./storeSlices";

export { channelDisplayName } from "./slices/channelDisplayName";
export { conversationDisplayName } from "./slices/conversationDisplayName";
export { dmDisplayName } from "./slices/dmDisplayName";
export { actionFeedback, composerFeedbackKey } from "./slices/feedback";
export { formatInteractorNames } from "./slices/interactorNames";
export { isPingingActivity } from "./slices/messaging/activity";
export { REMINDER_OPTIONS } from "./slices/messaging/messages";
export {
  findUnreadDividerIndex,
  isUnreadDividerBoundary,
} from "./slices/messaging/unread";
export type {
  ChannelDetailsPaneContent,
  ChannelDetailsTab,
  ChannelMessageTarget,
  MessageLocation,
  Nav,
  PaneContent,
  PinnedPaneContent,
  ProfilePaneContent,
  ThreadPaneContent,
  ThreadRef,
  UsergroupDetailsPaneContent,
  View,
} from "./slices/types";

declare global {
  interface Window {
    slock?: unknown;
  }
}

function setup() {
  const [bootstrap, { refetch: refetchBootstrap }] = createResource(fetchBootstrap);
  async function retryBootstrap(): Promise<void> {
    try {
      await refetchBootstrap();
    } catch {}
  }
  const [messageShortcutsRequested, setMessageShortcutsRequested] = createSignal(false);
  const [messageShortcuts, { refetch: refetchMessageShortcuts }] = createResource(
    messageShortcutsRequested,
    async (requested) => (requested ? fetchMessageShortcuts() : []),
  );
  const loadMessageShortcuts = () => setMessageShortcutsRequested(true);
  const retryMessageShortcuts = () =>
    void Promise.resolve(refetchMessageShortcuts()).catch(() => {});
  const [profileFieldDefsRequested, setProfileFieldDefsRequested] = createSignal(false);
  const [profileFieldDefs, { refetch: refetchProfileFieldDefs }] = createResource(
    profileFieldDefsRequested,
    async (requested) => (requested ? fetchProfileFieldDefs() : []),
  );
  const loadProfileFieldDefs = () => setProfileFieldDefsRequested(true);
  async function retryProfileFieldDefs(): Promise<void> {
    try {
      setProfileFieldDefsRequested(true);
      await refetchProfileFieldDefs();
    } catch {}
  }
  const runMessageShortcutAt = createRunMessageShortcut();
  const [userPrefs, { mutate: mutateUserPrefs, refetch: refetchUserPrefs }] =
    createResource(fetchUserPrefs);
  async function retryUserPrefs(): Promise<void> {
    try {
      await refetchUserPrefs();
    } catch {}
  }
  const slices = createStoreSlices({ bootstrap, userPrefs, mutateUserPrefs });
  const {
    viewState,
    users,
    usergroups,
    typing,
    channels,
    preferences,
    unread,
    activity,
    desktopNotifications,
    searchHistory,
    channelTabsSlice,
    later,
    dms,
    pinned,
    messages,
    modals,
    realtime,
    commands,
    panes,
    setActiveView,
    setActiveViewImplRef,
  } = slices;
  const actions = createAppActions({
    ...slices,
    setActiveView,
    setActiveViewImplRef,
  });
  const { markAllAsRead } = wireAppState({ ...slices, actions });

  const store = {
    activity,
    channels,
    channelTabs: channelTabsSlice,
    commands,
    desktopNotifications,
    dms,
    later,
    messages,
    modals,
    panes,
    pinned,
    preferences,
    realtime,
    searchHistory,
    typing,
    unread: { ...unread, markAllAsRead },
    users,
    usergroups,
    viewState: {
      ...viewState,
      ...actions,
    },
    resources: {
      bootstrap,
      messageShortcuts,
      loadMessageShortcuts,
      loadProfileFieldDefs,
      profileFieldDefs,
      retryBootstrap,
      retryMessageShortcuts,
      retryProfileFieldDefs,
      retryUserPrefs,
      runMessageShortcutAt,
      userPrefs,
    },
  };
  globalThis.slock = store;
  return store;
}
export const store = createRoot(setup);
