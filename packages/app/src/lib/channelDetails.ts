import {
  type ChannelDetails,
  type ChannelMembersPage,
  fetchChannelDetails,
  fetchChannelManagerIds,
  fetchChannelMembers,
  inviteToChannel,
  removeFromChannel,
  renameChannel,
  setChannelPostingPrefs,
  setChannelPurpose,
  setChannelRetention,
  setChannelTopic,
  setMemberPermissions,
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
    return withFeedback(id, "Failed to load channel details.", null, () => fetchChannelDetails(id));
  }

  function loadChannelMembers(
    id: string,
    filter: "everyone" | "apps",
    cursor?: string,
  ): Promise<ChannelMembersPage> {
    return withFeedback(id, "Failed to load members.", { members: [] }, () =>
      fetchChannelMembers(id, filter, cursor),
    );
  }

  function loadChannelManagerIds(id: string): Promise<string[]> {
    return withFeedback(id, "Failed to load channel managers.", [], () =>
      fetchChannelManagerIds(id),
    );
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

  function updateChannelPostingPrefs(
    id: string,
    opts: {
      postingRestrictedToManagers: boolean;
      threadsRestrictedToManagers: boolean;
      allowChannelMentions: boolean;
    },
  ): Promise<boolean> {
    return withFeedback(id, "Failed to update posting permissions.", false, async () => {
      await setChannelPostingPrefs(id, opts);
      return true;
    });
  }

  function updateChannelRetention(id: string, days: number | null): Promise<boolean> {
    return withFeedback(id, "Failed to update message retention.", false, async () => {
      await setChannelRetention(id, days);
      return true;
    });
  }

  function updateMemberPermissions(
    id: string,
    perms: { invite: boolean; setPurpose: boolean; setTopic: boolean },
  ): Promise<boolean> {
    return withFeedback(id, "Failed to update member permissions.", false, async () => {
      await setMemberPermissions(id, perms);
      return true;
    });
  }

  return {
    channelDetailsId,
    closeChannelDetails,
    inviteUsersToChannel,
    loadChannelDetails,
    loadChannelManagerIds,
    loadChannelMembers,
    openChannelDetails,
    removeUserFromChannel,
    renameChannelById,
    updateChannelPostingPrefs,
    updateChannelPurpose,
    updateChannelRetention,
    updateChannelTopic,
    updateMemberPermissions,
  };
}

export const {
  channelDetailsId,
  openChannelDetails,
  closeChannelDetails,
  loadChannelDetails,
  loadChannelMembers,
  loadChannelManagerIds,
  renameChannelById,
  updateChannelTopic,
  updateChannelPurpose,
  inviteUsersToChannel,
  removeUserFromChannel,
  updateChannelPostingPrefs,
  updateChannelRetention,
  updateMemberPermissions,
} = createRoot(setup);
