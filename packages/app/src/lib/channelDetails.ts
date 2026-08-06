import {
  archiveChannel,
  type ChannelDetails,
  type ChannelMembersPage,
  type ChannelPostingPrefs,
  type ChannelPostingPrefsPatch,
  convertChannelToPrivate,
  fetchChannelManagerIds,
  fetchChannelMembers,
  fetchChannelPostingPrefs,
  fetchConversationView,
  inviteToChannel,
  type MemberPermissionsPatch,
  removeFromChannel,
  renameChannel,
  setChannelPostingPrefs,
  setChannelPurpose,
  setChannelRetention,
  setChannelTopic,
  setMemberPermissions,
  unarchiveChannel,
} from "@slock/slack-api";
import { createRoot, createSignal } from "solid-js";
import { actionFeedback, store } from "./store";

export type MemberFilter = "everyone" | "managers" | "apps";

// Channel-details modal state and actions, kept out of the (already oversized)
// main store — it only touches the rest of the app through patchChannel.
function setup() {
  const [channelDetailsId, setChannelDetailsId] = createSignal<string | null>(null);

  function openChannelDetails(id: string) {
    setChannelDetailsId(id);
  }

  function closeChannelDetails() {
    setChannelDetailsId(null);
  }

  // Every action here follows the same shape: call the API, flash a message
  // keyed to the channel on failure, and fall back to a caller-given value
  // instead of throwing (the modal stays usable either way).
  async function withFeedback<T>(
    id: string,
    fallbackMessage: string,
    fallback: T,
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await action();
    } catch (err) {
      actionFeedback.flash(id, err instanceof Error ? err.message : fallbackMessage, "error");
      return fallback;
    }
  }

  function loadChannelDetails(id: string): Promise<ChannelDetails | null> {
    return withFeedback(
      id,
      "Failed to load channel details.",
      null,
      async () => (await fetchConversationView(id)).details,
    );
  }

  async function loadChannelMembers(
    id: string,
    filter: "everyone" | "apps",
    cursor?: string,
  ): Promise<ChannelMembersPage> {
    try {
      return await fetchChannelMembers(id, filter, cursor);
    } catch (err) {
      actionFeedback.flash(
        id,
        err instanceof Error ? err.message : "Failed to load members.",
        "error",
      );
      throw err;
    }
  }

  async function loadChannelManagerIds(id: string): Promise<string[]> {
    try {
      return await fetchChannelManagerIds(id);
    } catch (err) {
      actionFeedback.flash(
        id,
        err instanceof Error ? err.message : "Failed to load channel managers.",
        "error",
      );
      throw err;
    }
  }

  async function loadChannelPostingPrefs(id: string): Promise<ChannelPostingPrefs> {
    try {
      return await fetchChannelPostingPrefs(id);
    } catch (err) {
      actionFeedback.flash(
        id,
        err instanceof Error ? err.message : "Failed to load posting permissions.",
        "error",
      );
      throw err;
    }
  }

  function renameChannelById(id: string, name: string): Promise<boolean> {
    return withFeedback(id, "Failed to rename channel.", false, async () => {
      const finalName = await renameChannel(id, name);
      store.channels.patchChannel(id, { name: finalName });
      return true;
    });
  }

  function updateChannelTopic(id: string, topic: string): Promise<boolean> {
    return withFeedback(id, "Failed to set topic.", false, async () => {
      await setChannelTopic(id, topic);
      store.channels.patchChannel(id, { topic });
      return true;
    });
  }

  function updateChannelPurpose(id: string, purpose: string): Promise<boolean> {
    return withFeedback(id, "Failed to set description.", false, async () => {
      await setChannelPurpose(id, purpose);
      return true;
    });
  }

  function inviteUsersToChannel(id: string, userIds: string[]): Promise<boolean> {
    return withFeedback(id, "Failed to add to channel.", false, async () => {
      await inviteToChannel(id, userIds);
      return true;
    });
  }

  function removeUserFromChannel(id: string, userId: string): Promise<boolean> {
    return withFeedback(id, "Failed to remove from channel.", false, async () => {
      await removeFromChannel(id, userId);
      return true;
    });
  }

  async function updateChannelPostingPrefs(
    id: string,
    patch: ChannelPostingPrefsPatch,
  ): Promise<boolean> {
    try {
      await setChannelPostingPrefs(id, patch);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update posting permissions.";
      actionFeedback.flash(
        id,
        message === "not_permitted"
          ? "Slack denied this change. A workspace or organization policy may restrict who can edit posting permissions."
          : message,
        "error",
      );
      return false;
    }
  }

  function updateChannelRetention(id: string, days: number | null): Promise<boolean> {
    return withFeedback(id, "Failed to update message retention.", false, async () => {
      await setChannelRetention(id, days);
      return true;
    });
  }

  function updateMemberPermissions(id: string, patch: MemberPermissionsPatch): Promise<boolean> {
    return withFeedback(id, "Failed to update member permissions.", false, async () => {
      await setMemberPermissions(id, patch);
      return true;
    });
  }

  function archiveChannelById(id: string): Promise<boolean> {
    return withFeedback(id, "Failed to archive channel.", false, async () => {
      await archiveChannel(id);
      store.channels.patchChannel(id, { archived: true });
      return true;
    });
  }

  function unarchiveChannelById(id: string): Promise<boolean> {
    return withFeedback(id, "Failed to unarchive channel.", false, async () => {
      await unarchiveChannel(id);
      store.channels.patchChannel(id, { archived: false });
      return true;
    });
  }

  function convertChannelToPrivateById(id: string): Promise<boolean> {
    return withFeedback(id, "Failed to convert channel to private.", false, async () => {
      await convertChannelToPrivate(id);
      store.channels.patchChannel(id, { private: true });
      return true;
    });
  }

  return {
    archiveChannelById,
    channelDetailsId,
    closeChannelDetails,
    convertChannelToPrivateById,
    inviteUsersToChannel,
    loadChannelDetails,
    loadChannelManagerIds,
    loadChannelMembers,
    loadChannelPostingPrefs,
    openChannelDetails,
    removeUserFromChannel,
    renameChannelById,
    unarchiveChannelById,
    updateChannelPostingPrefs,
    updateChannelPurpose,
    updateChannelRetention,
    updateChannelTopic,
    updateMemberPermissions,
  };
}

export const {
  archiveChannelById,
  channelDetailsId,
  openChannelDetails,
  closeChannelDetails,
  convertChannelToPrivateById,
  loadChannelDetails,
  loadChannelMembers,
  loadChannelManagerIds,
  loadChannelPostingPrefs,
  renameChannelById,
  unarchiveChannelById,
  updateChannelTopic,
  updateChannelPurpose,
  inviteUsersToChannel,
  removeUserFromChannel,
  updateChannelPostingPrefs,
  updateChannelRetention,
  updateMemberPermissions,
} = createRoot(setup);
