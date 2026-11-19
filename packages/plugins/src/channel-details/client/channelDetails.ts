import { service } from "@slock/core/solid";
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
import { createKeyedQuery, defineKey } from "../../query/client/api";
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
} from "../../slack/client/api";

const channelDetailsKey = defineKey<[ChannelId]>("channelDetails");
const channelManagerIdsKey = defineKey<[ChannelId]>("channelManagerIds");
const channelPostingPrefsKey = defineKey<[ChannelId]>("channelPostingPrefs");
const memberPermissionsKey = defineKey<[ChannelId]>("memberPermissions");
const channelRetentionKey = defineKey<[ChannelId]>("channelRetention");
const feedback = service("feedback");

const channelsStore = service("channels");
const query = service("query");

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
    void query.client.invalidateQueries({ queryKey: channelDetailsKey(id) });
    if (postingChanged)
      void query.client.invalidateQueries({ queryKey: channelPostingPrefsKey(id) });
  }

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
    return withFeedbackOrThrow(id, "Failed to load channel managers.", () =>
      fetchChannelManagerIds(id),
    );
  }

  function createChannelQuery<T>(
    keyFor: (id: ChannelId) => readonly unknown[],
    id: () => ChannelId | null | undefined,
    load: (id: ChannelId) => Promise<T>,
  ) {
    return createKeyedQuery(() => {
      const channelId = id();
      return channelId
        ? { queryFn: () => load(channelId), queryKey: keyFor(channelId) }
        : undefined;
    });
  }

  const createChannelDetailsQuery = (id: () => ChannelId | null | undefined) =>
    createChannelQuery(channelDetailsKey, id, loadChannelDetails);
  const createChannelManagerIdsQuery = (id: () => ChannelId | null | undefined) =>
    createChannelQuery(channelManagerIdsKey, id, loadChannelManagerIds);
  const createChannelPostingPrefsQuery = (id: () => ChannelId | null | undefined) =>
    createChannelQuery<ChannelPostingPrefs>(channelPostingPrefsKey, id, fetchChannelPostingPrefs);
  const createChannelRetentionQuery = (id: () => ChannelId | null | undefined) =>
    createChannelQuery<number | null>(channelRetentionKey, id, fetchChannelRetention);

  const createMemberPermissionsQuery = (id: () => ChannelId | null | undefined) =>
    createChannelQuery(memberPermissionsKey, id, fetchMemberPermissions);

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

  function updateChannelPostingPrefs(id: ChannelId, patch: ChannelPostingPrefsPatch): Promise<void> {
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
