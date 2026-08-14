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
import { createRoot } from "solid-js";
import { actionFeedback, store } from "./store";
import type { ChannelDetailsTab } from "./store/slices/types";

export type MemberFilter = "everyone" | "managers" | "apps";
export type { ChannelDetailsTab };

function setup() {
  function openChannelDetails(id: string, tab: ChannelDetailsTab = "about") {
    store.panes.openInNewPane({ channelId: id, kind: "channel-details", tab });
  }

  function closeChannelDetails() {
    const pane = store.panes.panes().find((p) => p.content?.kind === "channel-details");
    if (pane) store.panes.closePane(pane.id);
  }

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

  async function withFeedbackOrThrow<T>(
    id: string,
    fallbackMessage: string,
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await action();
    } catch (err) {
      actionFeedback.flash(id, err instanceof Error ? err.message : fallbackMessage, "error");
      throw err;
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

  function loadChannelMembers(
    id: string,
    filter: "everyone" | "apps",
    cursor?: string,
  ): Promise<ChannelMembersPage> {
    return withFeedbackOrThrow(id, "Failed to load members.", () =>
      fetchChannelMembers(id, filter, cursor),
    );
  }

  function loadChannelManagerIds(id: string): Promise<string[]> {
    return withFeedbackOrThrow(id, "Failed to load channel managers.", () =>
      fetchChannelManagerIds(id),
    );
  }

  function loadChannelPostingPrefs(id: string): Promise<ChannelPostingPrefs> {
    return fetchChannelPostingPrefs(id);
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

  function updateChannelPostingPrefs(id: string, patch: ChannelPostingPrefsPatch): Promise<void> {
    return setChannelPostingPrefs(id, patch);
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
