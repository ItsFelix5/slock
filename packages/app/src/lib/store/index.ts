// biome-ignore-all lint/performance/noBarrelFile: This module is the store's deliberate public API.
// biome-ignore-all lint/performance/noNamespaceImport: The frecency module is used as a cohesive API.
import {
  fetchBootstrap,
  fetchMessageShortcuts,
  fetchProfileFieldDefs,
  fetchUserPrefs,
} from "@slock/slack-api";
import { createResource, createRoot } from "solid-js";
import { createAppActions } from "../appActions";
import { wireAppState } from "../appWiring";
import { createRunMessageShortcut } from "./runMessageShortcut";
import { createStoreSlices } from "./storeSlices";

export { channelDisplayName } from "./slices/channelDisplayName";
export { dmDisplayName } from "./slices/dmDisplayName";
export { actionFeedback } from "./slices/feedback";
export { isPingingActivity } from "./slices/messaging/activity";
export { REMINDER_OPTIONS } from "./slices/messaging/messages";

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
  const [bootstrap] = createResource(fetchBootstrap);
  const [messageShortcuts] = createResource(fetchMessageShortcuts);
  const [profileFieldDefs] = createResource(fetchProfileFieldDefs);
  const runMessageShortcutAt = createRunMessageShortcut();
  const [userPrefs] = createResource(fetchUserPrefs);
  const slices = createStoreSlices({ bootstrap, userPrefs });
  const {
    viewState,
    users,
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
    realtime,
    commands,
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
    pinned,
    preferences,
    realtime,
    searchHistory,
    typing,
    unread: { ...unread, markAllAsRead },
    users,
    viewState: {
      ...viewState,
      ...actions,
    },
    resources: {
      bootstrap,
      messageShortcuts,
      profileFieldDefs,
      runMessageShortcutAt,
    },
  };
  globalThis.slock = {
    bootstrap,
    messageShortcuts,
    profileFieldDefs,
    slices,
    store,
    userPrefs,
  };
  return store;
}
export const store = createRoot(setup);
