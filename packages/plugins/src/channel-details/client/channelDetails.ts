import { service } from "@slock/core/solid";
import { defineQuery, type Query } from "@slock/plugins/query/client/api";
import {
  archiveChannel,
  convertChannelToPrivate,
  fetchChannelManagerIds,
  fetchChannelMembers,
  fetchChannelPostingPrefs,
  fetchChannelRetention,
  fetchConversationView,
  fetchMemberPermissions,
  inviteToChannel,
  removeFromChannel,
  renameChannel,
  setChannelPostingPrefs,
  setChannelPurpose,
  setChannelRetention,
  setChannelTopic,
  setMemberPermissions,
  unarchiveChannel,
} from "@slock/plugins/slack/client/api";
import type {
  ChannelDetails,
  ChannelId,
  ChannelMembersPage,
  ChannelPostingPrefs,
  ChannelPostingPrefsPatch,
  MemberPermissionsPatch,
  User,
  UserId,
} from "@slock/types";
import { createSignal } from "solid-js";

const feedback = service("feedback");

const channelsStore = service("channels");

export type MemberFilter = "everyone" | "managers" | "apps";
export type ChannelDetailsTab = string;

export function createChannelDetailsStore() {
  const [channelDetailsId, setChannelDetailsId] = createSignal<ChannelId | null>(null);
  const [channelDetailsTab, setChannelDetailsTab] = createSignal<ChannelDetailsTab>("about");

  function openChannelDetails(id: ChannelId, tab: ChannelDetailsTab = "about") {
    setChannelDetailsTab(tab);
    setChannelDetailsId(id);
  }

  function closeChannelDetails() {
    setChannelDetailsId(null);
  }

  async function withFeedback<T>(
    id: ChannelId,
    fallbackMessage: string,
    fallback: T,
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await action();
    } catch (err) {
      feedback.caught(id, err, fallbackMessage);
      return fallback;
    }
  }

  async function withFeedbackOrThrow<T>(
    id: ChannelId,
    fallbackMessage: string,
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await action();
    } catch (err) {
      feedback.caught(id, err, fallbackMessage);
      throw err;
    }
  }

  function invalidateChannelDetails(id: ChannelId, postingChanged = false) {
    channelDetailsQuery.invalidate(id);
    if (postingChanged) channelPostingPrefsQuery.invalidate(id);
  }

  const channelDetailsQuery = defineQuery<ChannelId, ChannelDetails | null>({
    load: (id) => loadChannelDetails(id),
    name: "channelDetails",
  });
  const channelManagerIdsQuery = defineQuery<ChannelId, UserId[]>({
    load: (id) => loadChannelManagerIds(id),
    name: "channelManagerIds",
  });
  const channelPostingPrefsQuery = defineQuery<ChannelId, ChannelPostingPrefs>({
    load: fetchChannelPostingPrefs,
    name: "channelPostingPrefs",
  });
  const channelRetentionQuery = defineQuery<ChannelId, number | null>({
    load: fetchChannelRetention,
    name: "channelRetention",
  });
  const memberPermissionsQuery = defineQuery<
    ChannelId,
    Awaited<ReturnType<typeof fetchMemberPermissions>>
  >({
    load: fetchMemberPermissions,
    name: "memberPermissions",
  });

  function loadChannelDetails(id: ChannelId): Promise<ChannelDetails | null> {
    return withFeedback(
      id,
      "Failed to load channel details.",
      null,
      async () => (await fetchConversationView(id)).details,
    );
  }

  function loadChannelMembersPage(
    id: ChannelId,
    filter: "everyone" | "apps",
    cursor?: string,
  ): Promise<ChannelMembersPage> {
    return withFeedbackOrThrow(id, "Failed to load members.", () =>
      fetchChannelMembers(id, filter, cursor),
    );
  }

  function searchChannelMembers(id: ChannelId, search: string): Promise<User[]> {
    return withFeedbackOrThrow(
      id,
      "Failed to search members.",
      async () => (await fetchChannelMembers(id, "everyone", undefined, search)).members,
    );
  }

  function loadChannelManagerIds(id: ChannelId): Promise<UserId[]> {
    return withFeedbackOrThrow(
      id,
      "Failed to load channel managers.",
      async () => await fetchChannelManagerIds(id),
    );
  }

  const stateOf =
    <T>(query: Query<ChannelId, T>) =>
    (id: () => ChannelId | null | undefined) =>
      query.state(() => id() ?? undefined);

  const createChannelDetailsQuery = stateOf(channelDetailsQuery);
  const createChannelManagerIdsQuery = stateOf(channelManagerIdsQuery);
  const createChannelPostingPrefsQuery = stateOf(channelPostingPrefsQuery);
  const createChannelRetentionQuery = stateOf(channelRetentionQuery);
  const createMemberPermissionsQuery = stateOf(memberPermissionsQuery);

  function renameChannelById(id: ChannelId, name: string): Promise<boolean> {
    return withFeedback(id, "Failed to rename channel.", false, async () => {
      const finalName = await renameChannel(id, name);
      channelsStore.patchChannel(id, { name: finalName });
      return true;
    });
  }

  function updateChannelTopic(id: ChannelId, topic: string): Promise<boolean> {
    return withFeedback(id, "Failed to set topic.", false, async () => {
      await setChannelTopic(id, topic);
      channelsStore.patchChannel(id, { topic });
      return true;
    });
  }

  function updateChannelPurpose(id: ChannelId, purpose: string): Promise<boolean> {
    return withFeedback(id, "Failed to set description.", false, async () => {
      await setChannelPurpose(id, purpose);
      return true;
    });
  }

  function inviteUsersToChannel(id: ChannelId, userIds: UserId[]): Promise<boolean> {
    return withFeedback(id, "Failed to add to channel.", false, async () => {
      await inviteToChannel(id, userIds);
      return true;
    });
  }

  function removeUserFromChannel(id: ChannelId, userId: UserId): Promise<boolean> {
    return withFeedback(id, "Failed to remove from channel.", false, async () => {
      await removeFromChannel(id, userId);
      return true;
    });
  }

  function updateChannelPostingPrefs(
    id: ChannelId,
    patch: ChannelPostingPrefsPatch,
  ): Promise<void> {
    return setChannelPostingPrefs(id, patch);
  }

  function updateChannelRetention(id: ChannelId, days: number | null): Promise<boolean> {
    return withFeedback(id, "Failed to update message retention.", false, async () => {
      await setChannelRetention(id, days);
      return true;
    });
  }

  function updateMemberPermissions(id: ChannelId, patch: MemberPermissionsPatch): Promise<boolean> {
    return withFeedback(id, "Failed to update member permissions.", false, async () => {
      await setMemberPermissions(id, patch);
      return true;
    });
  }

  function archiveChannelById(id: ChannelId): Promise<boolean> {
    return withFeedback(id, "Failed to archive channel.", false, async () => {
      await archiveChannel(id);
      channelsStore.patchChannel(id, { archived: true });
      return true;
    });
  }

  function unarchiveChannelById(id: ChannelId): Promise<boolean> {
    return withFeedback(id, "Failed to unarchive channel.", false, async () => {
      await unarchiveChannel(id);
      channelsStore.patchChannel(id, { archived: false });
      return true;
    });
  }

  function convertChannelToPrivateById(id: ChannelId): Promise<boolean> {
    return withFeedback(id, "Failed to convert channel to private.", false, async () => {
      await convertChannelToPrivate(id);
      channelsStore.patchChannel(id, { private: true });
      return true;
    });
  }

  return {
    archiveChannelById,
    channelDetailsId,
    channelDetailsTab,
    closeChannelDetails,
    convertChannelToPrivateById,
    invalidateChannelDetails,
    inviteUsersToChannel,
    createChannelDetailsQuery,
    createChannelManagerIdsQuery,
    createChannelPostingPrefsQuery,
    createChannelRetentionQuery,
    createMemberPermissionsQuery,
    queries: {
      details: channelDetailsQuery,
      managerIds: channelManagerIdsQuery,
      memberPermissions: memberPermissionsQuery,
      postingPrefs: channelPostingPrefsQuery,
      retention: channelRetentionQuery,
    },
    loadChannelManagerIds,
    loadChannelMembersPage,
    searchChannelMembers,
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
