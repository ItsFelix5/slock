import {
  setUsergroupChannels,
  setUsergroupMembers,
  updateUsergroupProfile,
} from "@slock/slack-api";
import { createRoot, createSignal } from "solid-js";
import { actionFeedback, store } from "./store";

// Pinggroup-details panel state and actions, kept out of the main store the
// same way channelDetails.ts is — it only touches the rest of the app
// through store.usergroups.
function setup() {
  const [usergroupDetailsId, setUsergroupDetailsId] = createSignal<string | null>(null);

  function openUsergroupDetails(id: string) {
    setUsergroupDetailsId(id);
    store.usergroups.refreshUsergroupDetails(id).catch(() => {
      actionFeedback.flash(id, "Failed to load pinggroup details.", "error");
    });
  }

  function closeUsergroupDetails() {
    setUsergroupDetailsId(null);
  }

  async function withFeedback(
    id: string,
    fallbackMessage: string,
    action: () => Promise<void>,
  ): Promise<boolean> {
    try {
      await action();
      await store.usergroups.refreshUsergroupDetails(id);
      return true;
    } catch (err) {
      actionFeedback.flash(id, err instanceof Error ? err.message : fallbackMessage, "error");
      return false;
    }
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

  return {
    addUsergroupChannels,
    addUsergroupMembers,
    closeUsergroupDetails,
    openUsergroupDetails,
    removeUsergroupChannel,
    removeUsergroupMember,
    saveUsergroupProfile,
    usergroupDetailsId,
  };
}

export const {
  addUsergroupChannels,
  addUsergroupMembers,
  closeUsergroupDetails,
  openUsergroupDetails,
  removeUsergroupChannel,
  removeUsergroupMember,
  saveUsergroupProfile,
  usergroupDetailsId,
} = createRoot(setup);
