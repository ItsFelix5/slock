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
import { patchChannel } from "./store";
import { actionFeedback } from "./store/feedback";

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

  async function loadChannelDetails(id: string): Promise<ChannelDetails | null> {
    try {
      return await fetchChannelDetails(id);
    } catch (err) {
      actionFeedback.flash(
        id,
        err instanceof Error ? err.message : "Failed to load channel details.",
        "error",
      );
      return null;
    }
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
      return { members: [] };
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
      return [];
    }
  }

  async function renameChannelById(id: string, name: string): Promise<boolean> {
    try {
      const finalName = await renameChannel(id, name);
      patchChannel(id, { name: finalName });
      return true;
    } catch (err) {
      actionFeedback.flash(
        id,
        err instanceof Error ? err.message : "Failed to rename channel.",
        "error",
      );
      return false;
    }
  }

  async function updateChannelTopic(id: string, topic: string): Promise<boolean> {
    try {
      await setChannelTopic(id, topic);
      patchChannel(id, { topic });
      return true;
    } catch (err) {
      actionFeedback.flash(
        id,
        err instanceof Error ? err.message : "Failed to set topic.",
        "error",
      );
      return false;
    }
  }

  async function updateChannelPurpose(id: string, purpose: string): Promise<boolean> {
    try {
      await setChannelPurpose(id, purpose);
      return true;
    } catch (err) {
      actionFeedback.flash(
        id,
        err instanceof Error ? err.message : "Failed to set description.",
        "error",
      );
      return false;
    }
  }

  async function inviteUsersToChannel(id: string, userIds: string[]): Promise<boolean> {
    try {
      await inviteToChannel(id, userIds);
      return true;
    } catch (err) {
      actionFeedback.flash(
        id,
        err instanceof Error ? err.message : "Failed to add to channel.",
        "error",
      );
      return false;
    }
  }

  async function removeUserFromChannel(id: string, userId: string): Promise<boolean> {
    try {
      await removeFromChannel(id, userId);
      return true;
    } catch (err) {
      actionFeedback.flash(
        id,
        err instanceof Error ? err.message : "Failed to remove from channel.",
        "error",
      );
      return false;
    }
  }

  async function updateChannelPostingPrefs(
    id: string,
    opts: {
      postingRestrictedToManagers: boolean;
      threadsRestrictedToManagers: boolean;
      allowChannelMentions: boolean;
    },
  ): Promise<boolean> {
    try {
      await setChannelPostingPrefs(id, opts);
      return true;
    } catch (err) {
      actionFeedback.flash(
        id,
        err instanceof Error ? err.message : "Failed to update posting permissions.",
        "error",
      );
      return false;
    }
  }

  async function updateChannelRetention(id: string, days: number | null): Promise<boolean> {
    try {
      await setChannelRetention(id, days);
      return true;
    } catch (err) {
      actionFeedback.flash(
        id,
        err instanceof Error ? err.message : "Failed to update message retention.",
        "error",
      );
      return false;
    }
  }

  async function updateMemberPermissions(
    id: string,
    perms: { invite: boolean; setPurpose: boolean; setTopic: boolean },
  ): Promise<boolean> {
    try {
      await setMemberPermissions(id, perms);
      return true;
    } catch (err) {
      actionFeedback.flash(
        id,
        err instanceof Error ? err.message : "Failed to update member permissions.",
        "error",
      );
      return false;
    }
  }

  return {
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
