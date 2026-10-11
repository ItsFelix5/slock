import { service } from "@slock/core/solid";
import type {
  ChannelDetails,
  ChannelMembersPage,
  ChannelPostingPrefs,
  ChannelPostingPrefsPatch,
  MemberPermissionsPatch,
  User,
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

const channelDetailsKey = defineKey<[string]>("channelDetails");
const channelManagerIdsKey = defineKey<[string]>("channelManagerIds");
const channelPostingPrefsKey = defineKey<[string]>("channelPostingPrefs");
const channelRetentionKey = defineKey<[string]>("channelRetention");
const feedback = service("feedback");

const channelsStore = service("channels");

export type MemberFilter = "everyone" | "managers" | "apps";
export type ChannelDetailsTab = string;

export function createChannelDetailsStore() {
  const [channelDetailsId, setChannelDetailsId] = createSignal<string | null>(null);
  const [channelDetailsTab, setChannelDetailsTab] = createSignal<ChannelDetailsTab>("about");

  function openChannelDetails(id: string, tab: ChannelDetailsTab = "about") {
    setChannelDetailsTab(tab);
    setChannelDetailsId(id);
  }

  function closeChannelDetails() {
    setChannelDetailsId(null);
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
      feedback.caught(id, err, fallbackMessage);
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
      feedback.caught(id, err, fallbackMessage);
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

  function loadChannelMembersPage(
    id: string,
    filter: "everyone" | "apps",
    cursor?: string,
  ): Promise<ChannelMembersPage> {
    return withFeedbackOrThrow(id, "Failed to load members.", () =>
      fetchChannelMembers(id, filter, cursor),
    );
  }

  function searchChannelMembers(id: string, search: string): Promise<User[]> {
    return withFeedbackOrThrow(
      id,
      "Failed to search members.",
      async () => (await fetchChannelMembers(id, "everyone", undefined, search)).members,
    );
  }

  function loadChannelManagerIds(id: string): Promise<string[]> {
    return withFeedbackOrThrow(id, "Failed to load channel managers.", () =>
      fetchChannelManagerIds(id),
    );
  }

  function createChannelQuery<T>(
    keyFor: (id: string) => readonly unknown[],
    id: () => string | null | undefined,
    load: (id: string) => Promise<T>,
  ) {
    return createKeyedQuery(() => {
      const channelId = id();
      return channelId
        ? { queryFn: () => load(channelId), queryKey: keyFor(channelId) }
        : undefined;
    });
  }

  const createChannelDetailsQuery = (id: () => string | null | undefined) =>
    createChannelQuery(channelDetailsKey, id, loadChannelDetails);
  const createChannelManagerIdsQuery = (id: () => string | null | undefined) =>
    createChannelQuery(channelManagerIdsKey, id, loadChannelManagerIds);
  const createChannelPostingPrefsQuery = (id: () => string | null | undefined) =>
    createChannelQuery<ChannelPostingPrefs>(channelPostingPrefsKey, id, fetchChannelPostingPrefs);
  const createChannelRetentionQuery = (id: () => string | null | undefined) =>
    createChannelQuery<number | null>(channelRetentionKey, id, fetchChannelRetention);

  function renameChannelById(id: string, name: string): Promise<boolean> {
    return withFeedback(id, "Failed to rename channel.", false, async () => {
      const finalName = await renameChannel(id, name);
      channelsStore.patchChannel(id, { name: finalName });
      return true;
    });
  }

  function updateChannelTopic(id: string, topic: string): Promise<boolean> {
    return withFeedback(id, "Failed to set topic.", false, async () => {
      await setChannelTopic(id, topic);
      channelsStore.patchChannel(id, { topic });
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
      channelsStore.patchChannel(id, { archived: true });
      return true;
    });
  }

  function unarchiveChannelById(id: string): Promise<boolean> {
    return withFeedback(id, "Failed to unarchive channel.", false, async () => {
      await unarchiveChannel(id);
      channelsStore.patchChannel(id, { archived: false });
      return true;
    });
  }

  function convertChannelToPrivateById(id: string): Promise<boolean> {
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
    inviteUsersToChannel,
    createChannelDetailsQuery,
    createChannelManagerIdsQuery,
    createChannelPostingPrefsQuery,
    createChannelRetentionQuery,
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
