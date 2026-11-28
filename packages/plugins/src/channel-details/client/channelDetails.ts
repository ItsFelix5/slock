import { service } from "@slock/core/solid";
import { defineMutation } from "@slock/plugins/query/client/api";
import type { Channel, ChannelId } from "@slock/types";
import { createSignal } from "solid-js";
import {
  archiveChannel,
  convertChannelToPrivate,
  renameChannel,
  setChannelPurpose,
  setChannelTopic,
  unarchiveChannel,
} from "./requests";

const channelsStore = service("channels");
const dmsStore = service("dms");
const feedback = service("feedback");

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

  const kindOf = (id: ChannelId) => (dmsStore.isGroupDm(id) ? "group chat" : "channel");

  async function applyChange(id: ChannelId, patch: Partial<Channel>) {
    if (dmsStore.isGroupDm(id)) await dmsStore.refreshGroupDm(id);
    else channelsStore.patchChannel(id, patch);
  }

  const editing = defineMutation<{ failure: string; id: ChannelId; save: () => Promise<void> }>({
    onError: (error, { failure, id }) => feedback.caught(id, error, failure),
    run: ({ save }) => save(),
  });

  const archiving = defineMutation<{ archived: boolean; id: ChannelId }>({
    key: ({ id }) => id,
    mode: "single",
    onError: (error, { archived, id }) =>
      feedback.caught(id, error, `Failed to ${archived ? "archive" : "unarchive"} channel.`),
    onSuccess: (_, { archived, id }) => channelsStore.patchChannel(id, { archived }),
    run: ({ archived, id }) => (archived ? archiveChannel(id) : unarchiveChannel(id)),
  });

  const converting = defineMutation<{ groupDmName?: string; id: ChannelId }>({
    key: ({ id }) => id,
    mode: "single",
    onError: (error, { id }) => feedback.caught(id, error, `Failed to make ${kindOf(id)} private.`),
    run: async ({ groupDmName, id }) => {
      await convertChannelToPrivate(id, groupDmName);
      await applyChange(id, { private: true });
    },
  });

  return {
    archiveChannelById: (id: ChannelId) => archiving.run({ archived: true, id }),
    channelDetailsId,
    channelDetailsTab,
    closeChannelDetails,
    convertToPrivateById: (id: ChannelId, groupDmName?: string) =>
      converting.run({ groupDmName, id }),
    isArchivePending: (id: ChannelId) => archiving.pending(id),
    isConvertPending: (id: ChannelId) => converting.pending(id),
    openChannelDetails,
    renameChannelById: (id: ChannelId, name: string) =>
      editing.run({
        failure: `Failed to rename ${kindOf(id)}.`,
        id,
        save: async () => applyChange(id, { name: await renameChannel(id, name) }),
      }),
    unarchiveChannelById: (id: ChannelId) => archiving.run({ archived: false, id }),
    updateChannelPurpose: (id: ChannelId, purpose: string) =>
      editing.run({
        failure: "Failed to set description.",
        id,
        save: () => setChannelPurpose(id, purpose),
      }),
    updateChannelTopic: (id: ChannelId, topic: string) =>
      editing.run({
        failure: "Failed to set topic.",
        id,
        save: async () => {
          await setChannelTopic(id, topic);
          await applyChange(id, { topic });
        },
      }),
  };
}
