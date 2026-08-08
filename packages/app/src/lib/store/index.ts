// biome-ignore-all lint/performance/noBarrelFile: This module is the store's deliberate public API.
// biome-ignore-all lint/performance/noNamespaceImport: The frecency module is used as a cohesive API.
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
export { findUnreadDividerIndex, isUnreadDividerBoundary } from "./slices/messaging/unread";
export { resolveUnreadLandingIndex } from "./slices/messaging/unreadLanding";
export type { ChannelMessageTarget, MessageLocation, Nav, ThreadRef, View } from "./slices/types";

declare global {
  interface Window {
    /**
     * Live client-store inspector. Intended for use from the browser console.
     * `state` is always evaluated at access time; `store` contains the actions
     * and reactive accessors used by the application itself.
     */
    slock?: unknown;
  }
}

function setup() {
  const [bootstrap, { refetch: refetchBootstrap }] = createResource(fetchBootstrap);
  async function retryBootstrap(): Promise<void> {
    try {
      await refetchBootstrap();
    } catch {
      // The resource keeps the error available to the full-screen retry UI.
    }
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
    } catch {
      // The profile panel reads the resource error and keeps retry available.
    }
  }
  const runMessageShortcutAt = createRunMessageShortcut();
  const [userPrefs, { mutate: mutateUserPrefs, refetch: refetchUserPrefs }] =
    createResource(fetchUserPrefs);
  async function retryUserPrefs(): Promise<void> {
    try {
      await refetchUserPrefs();
    } catch {
      // The resource exposes the error to retry UIs.
    }
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
    canvas,
    messages,
    modals,
    realtime,
    commands,
    undo,
    setActiveView,
    setActiveViewImplRef,
  } = slices;
  const actions = createAppActions({ ...slices, setActiveView, setActiveViewImplRef });
  const { markAllAsRead } = wireAppState({ ...slices, actions });
  // Keep each domain at its own stable path.  In particular, consumers should
  // use `store.viewState.activeThread()` instead of reaching through a single
  // flat collection of every state value and action.
  const store = {
    activity,
    canvas,
    channels,
    channelTabs: channelTabsSlice,
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
    typing,
    undo,
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
