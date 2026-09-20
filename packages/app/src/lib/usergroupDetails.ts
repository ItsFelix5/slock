import { createRoot, createSignal } from "solid-js";
import {
  setUsergroupChannels,
  setUsergroupMembers,
  setUsergroupSectionEnabled,
  updateUsergroupProfile,
} from "./api";
import { flashCaughtError } from "./feedback";
import { queryClient } from "./queryClient";
import { store } from "./store";
import { usergroupDetailsQueryOptions } from "./store/slices/entities/usergroups";
import { createSerialMutationQueue } from "./store/slices/entities/usersProfileFields";

function refreshUsergroupDetails(id: string) {
  return queryClient.query(usergroupDetailsQueryOptions(id));
}

function setup() {
  const [usergroupDetailsLoading, setUsergroupDetailsLoading] = createSignal(false);
  const [usergroupDetailsLoadError, setUsergroupDetailsLoadError] = createSignal(false);
  const [usergroupMutationPending, setUsergroupMutationPending] = createSignal(false);
  let loadEpoch = 0;
  let pendingMutationCount = 0;
  const runMutation = createSerialMutationQueue();

  async function loadUsergroupDetails(id: string): Promise<boolean> {
    const epoch = ++loadEpoch;
    setUsergroupDetailsLoading(true);
    setUsergroupDetailsLoadError(false);
    try {
      const details = await refreshUsergroupDetails(id);
      if (!details) throw new Error("Pinggroup details are unavailable.");
      return true;
    } catch (err) {
      if (epoch !== loadEpoch) return false;
      setUsergroupDetailsLoadError(true);
      flashCaughtError(id, err, "Failed to load pinggroup details.");
      return false;
    } finally {
      if (epoch === loadEpoch) setUsergroupDetailsLoading(false);
    }
  }

  function openUsergroupDetails(id: string) {
    store.panes.openInNewPane({ kind: "usergroup-details", usergroupId: id });
  }

  function closeUsergroupDetails() {
    loadEpoch++;
    setUsergroupDetailsLoading(false);
    setUsergroupDetailsLoadError(false);
    const pane = store.panes.panes().find((p) => p.content?.kind === "usergroup-details");
    if (pane) store.panes.closePane(pane.id);
  }

  function withFeedback(
    id: string,
    fallbackMessage: string,
    action: () => Promise<void>,
  ): Promise<boolean> {
    pendingMutationCount++;
    setUsergroupMutationPending(true);
    return runMutation(async () => {
      try {
        await action();
        const details = await refreshUsergroupDetails(id);
        if (!details) throw new Error("Pinggroup details are unavailable.");
        return true;
      } catch (err) {
        flashCaughtError(id, err, fallbackMessage);
        return false;
      } finally {
        pendingMutationCount--;
        setUsergroupMutationPending(pendingMutationCount > 0);
      }
    });
  }

  function saveUsergroupProfile(
    id: string,
    patch: { name?: string; handle?: string; description?: string },
  ): Promise<boolean> {
    return withFeedback(id, "Failed to update pinggroup.", () => updateUsergroupProfile(id, patch));
  }

  function addUsergroupMembers(id: string, userIds: string[]): Promise<boolean> {
    return withFeedback(id, "Failed to add members.", () => {
      const current = store.usergroups.usergroupDetailsById(id)?.memberIds ?? [];
      return setUsergroupMembers(id, [...new Set([...current, ...userIds])]);
    });
  }

  function removeUsergroupMember(id: string, userId: string): Promise<boolean> {
    return withFeedback(id, "Failed to remove member.", () => {
      const current = store.usergroups.usergroupDetailsById(id)?.memberIds ?? [];
      return setUsergroupMembers(
        id,
        current.filter((memberId) => memberId !== userId),
      );
    });
  }

  function addUsergroupChannels(id: string, channelIds: string[]): Promise<boolean> {
    return withFeedback(id, "Failed to add channels.", () => {
      const current = store.usergroups.usergroupDetailsById(id)?.channelIds ?? [];
      return setUsergroupChannels(id, [...new Set([...current, ...channelIds])]);
    });
  }

  function removeUsergroupChannel(id: string, channelId: string): Promise<boolean> {
    return withFeedback(id, "Failed to remove channel.", () => {
      const current = store.usergroups.usergroupDetailsById(id)?.channelIds ?? [];
      return setUsergroupChannels(
        id,
        current.filter((cid) => cid !== channelId),
      );
    });
  }

  function setUsergroupChannelSectionEnabled(id: string, enabled: boolean): Promise<boolean> {
    return withFeedback(
      id,
      enabled ? "Failed to create the group section." : "Failed to remove the group section.",
      () => setUsergroupSectionEnabled(id, enabled),
    ).then(async (updated) => {
      if (updated) await store.channels.retrySections();
      return updated;
    });
  }

  return {
    addUsergroupChannels,
    addUsergroupMembers,
    closeUsergroupDetails,
    loadUsergroupDetails,
    openUsergroupDetails,
    removeUsergroupChannel,
    removeUsergroupMember,
    saveUsergroupProfile,
    setUsergroupChannelSectionEnabled,
    usergroupDetailsLoadError,
    usergroupDetailsLoading,
    usergroupMutationPending,
  };
}

export const {
  addUsergroupChannels,
  addUsergroupMembers,
  closeUsergroupDetails,
  loadUsergroupDetails,
  openUsergroupDetails,
  removeUsergroupChannel,
  removeUsergroupMember,
  saveUsergroupProfile,
  setUsergroupChannelSectionEnabled,
  usergroupDetailsLoadError,
  usergroupDetailsLoading,
  usergroupMutationPending,
} = createRoot(setup);
