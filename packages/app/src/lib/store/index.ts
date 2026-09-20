import { createQuery } from "@tanstack/solid-query";
import { createRoot, createSignal } from "solid-js";
import {
  fetchBootstrap,
  fetchMessageShortcuts,
  fetchProfileFieldDefs,
  fetchUserPrefs,
  type UserPrefs,
} from "../api";
import { createAppActions } from "../appActions";
import { wireAppState } from "../appWiring";
import { queryClient } from "../queryClient";
import { createRunMessageShortcut } from "../runMessageShortcut";
import { createStoreSlices } from "./storeSlices";

export { queryClient } from "../queryClient";

export type {
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
  const bootstrap = createQuery(
    () => ({ queryKey: ["bootstrap"], queryFn: fetchBootstrap }),
    () => queryClient,
  );
  async function retryBootstrap(): Promise<void> {
    try {
      await bootstrap.refetch();
    } catch {}
  }
  const [messageShortcutsRequested, setMessageShortcutsRequested] = createSignal(false);
  const messageShortcuts = createQuery(
    () => ({
      queryKey: ["messageShortcuts"],
      queryFn: fetchMessageShortcuts,
      enabled: messageShortcutsRequested(),
    }),
    () => queryClient,
  );
  const loadMessageShortcuts = () => setMessageShortcutsRequested(true);
  const retryMessageShortcuts = () => void messageShortcuts.refetch().catch(() => {});
  const [profileFieldDefsRequested, setProfileFieldDefsRequested] = createSignal(false);
  const profileFieldDefs = createQuery(
    () => ({
      queryKey: ["profileFieldDefs"],
      queryFn: fetchProfileFieldDefs,
      enabled: profileFieldDefsRequested(),
    }),
    () => queryClient,
  );
  const loadProfileFieldDefs = () => setProfileFieldDefsRequested(true);
  async function retryProfileFieldDefs(): Promise<void> {
    try {
      setProfileFieldDefsRequested(true);
      await profileFieldDefs.refetch();
    } catch {}
  }
  const runMessageShortcutAt = createRunMessageShortcut();
  const userPrefs = createQuery(
    () => ({ queryKey: ["userPrefs"], queryFn: fetchUserPrefs }),
    () => queryClient,
  );
  const mutateUserPrefs = (updater: (current: UserPrefs | undefined) => UserPrefs | undefined) =>
    queryClient.setQueryData(["userPrefs"], updater);
  async function retryUserPrefs(): Promise<void> {
    try {
      await userPrefs.refetch();
    } catch {}
  }
  const slices = createStoreSlices({
    bootstrap: () => bootstrap.data,
    userPrefs: () => userPrefs.data,
    mutateUserPrefs,
  });
  const {
    viewState,
    users,
    usergroups,
    typing,
    canvas,
    channels,
    preferences,
    unread,
    activity,
    desktopNotifications,
    searchHistory,
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
    canvas,
    channels,
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
