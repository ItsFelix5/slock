import { service } from "@slock/core/solid";
import { defineMutation } from "@slock/plugins/query/client/api";
import type { ChannelId, UserId } from "@slock/types";
import {
  setUsergroupChannels,
  setUsergroupMembers,
  setUsergroupSectionEnabled,
  updateUsergroupProfile,
} from "./requests";

const feedback = service("feedback");

const panesStore = service("shell.panes");
const channelsStore = service("channels");

const usergroups = service("usergroups");

async function freshDetails(id: string) {
  const details = await usergroups.refreshUsergroupDetails(id);
  if (!details) throw new Error("Pinggroup details are unavailable.");
  return details;
}

const load = defineMutation<string, unknown>({
  key: (id) => id,
  mode: "single",
  onError: (error, id) => feedback.caught(id, error, "Failed to load pinggroup details."),
  run: freshDetails,
});

const change = defineMutation<{ action: () => Promise<void>; failure: string; id: string }>({
  key: ({ id }) => id,
  mode: "queue",
  onError: (error, { failure, id }) => feedback.caught(id, error, failure),
  run: async ({ action, id }) => {
    await action();
    await freshDetails(id);
  },
});

export function createUsergroupDetails() {
  function loadUsergroupDetails(id: string): Promise<boolean> {
    return load.run(id);
  }

  function usergroupDetailsLoading(id: string): boolean {
    return load.pending(id);
  }

  function usergroupDetailsLoadError(id: string): boolean {
    if (load.pending(id)) return false;
    const { data, status } = usergroups.usergroupDetailsState(id);
    return data === null || status === "error";
  }

  function usergroupMutationPending(id: string): boolean {
    return change.pending(id);
  }

  function openUsergroupDetails(id: string) {
    panesStore.openInNewPane({ kind: "usergroup-details", usergroupId: id });
  }

  function mutate(id: string, failure: string, action: () => Promise<void>): Promise<boolean> {
    return change.run({ action, failure, id });
  }

  function saveUsergroupProfile(
    id: string,
    patch: { name?: string; handle?: string; description?: string },
  ): Promise<boolean> {
    return mutate(id, "Failed to update pinggroup.", () => updateUsergroupProfile(id, patch));
  }

  function addUsergroupMembers(id: string, userIds: UserId[]): Promise<boolean> {
    return mutate(id, "Failed to add members.", async () => {
      const { memberIds } = await freshDetails(id);
      return setUsergroupMembers(id, [...new Set([...memberIds, ...userIds])]);
    });
  }

  function removeUsergroupMember(id: string, userId: UserId): Promise<boolean> {
    return mutate(id, "Failed to remove member.", async () => {
      const { memberIds } = await freshDetails(id);
      return setUsergroupMembers(
        id,
        memberIds.filter((memberId) => memberId !== userId),
      );
    });
  }

  function addUsergroupChannels(id: string, channelIds: ChannelId[]): Promise<boolean> {
    return mutate(id, "Failed to add channels.", async () => {
      const details = await freshDetails(id);
      return setUsergroupChannels(id, [...new Set([...details.channelIds, ...channelIds])]);
    });
  }

  function removeUsergroupChannel(id: string, channelId: ChannelId): Promise<boolean> {
    return mutate(id, "Failed to remove channel.", async () => {
      const { channelIds } = await freshDetails(id);
      return setUsergroupChannels(
        id,
        channelIds.filter((cid) => cid !== channelId),
      );
    });
  }

  async function setUsergroupChannelSectionEnabled(id: string, enabled: boolean): Promise<boolean> {
    const updated = await mutate(
      id,
      enabled ? "Failed to create the group section." : "Failed to remove the group section.",
      () => setUsergroupSectionEnabled(id, enabled),
    );
    if (updated) await channelsStore.retrySections();
    return updated;
  }

  return {
    addUsergroupChannels,
    addUsergroupMembers,
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
