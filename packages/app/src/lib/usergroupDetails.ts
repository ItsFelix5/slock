import {
  setUsergroupChannels,
  setUsergroupMembers,
  setUsergroupSectionEnabled,
  updateUsergroupProfile,
} from "@slock/slack-api";
import { createRoot, createSignal } from "solid-js";
import { actionFeedback, store } from "./store";
import { createSerialMutationQueue } from "./store/mutations/serialMutationQueue";

// Pinggroup-details panel state and actions, kept out of the main store the
// same way channelDetails.ts is — it only touches the rest of the app
// through store.usergroups.
function setup() {
  const [usergroupDetailsId, setUsergroupDetailsId] = createSignal<string | null>(null);
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
      const details = await store.usergroups.refreshUsergroupDetails(id);
      if (!details) throw new Error("Pinggroup details are unavailable.");
      return true;
    } catch (err) {
      if (epoch !== loadEpoch || usergroupDetailsId() !== id) return false;
      setUsergroupDetailsLoadError(true);
      actionFeedback.flash(
        id,
        err instanceof Error ? err.message : "Failed to load pinggroup details.",
        "error",
      );
      return false;
    } finally {
      if (epoch === loadEpoch) setUsergroupDetailsLoading(false);
    }
  }

  function openUsergroupDetails(id: string) {
    setUsergroupDetailsId(id);
    void loadUsergroupDetails(id);
  }

  function closeUsergroupDetails() {
    loadEpoch++;
    setUsergroupDetailsLoading(false);
    setUsergroupDetailsLoadError(false);
    setUsergroupDetailsId(null);
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
        const details = await store.usergroups.refreshUsergroupDetails(id);
        if (!details) throw new Error("Pinggroup details are unavailable.");
        return true;
      } catch (err) {
        actionFeedback.flash(id, err instanceof Error ? err.message : fallbackMessage, "error");
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
    usergroupDetailsId,
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
  usergroupDetailsId,
  usergroupDetailsLoadError,
  usergroupDetailsLoading,
  usergroupMutationPending,
} = createRoot(setup);
