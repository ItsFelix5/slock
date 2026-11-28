import { service } from "@slock/core/solid";
import { defineMutation, defineQuery } from "@slock/plugins/query/client/api";
import type {
  ChannelId,
  ChannelPostingPrefs,
  ChannelPostingPrefsPatch,
  MemberPermissionsPatch,
} from "@slock/types";
import { fetchChannelPostingPrefs, setChannelPostingPrefs } from "./postingPrefs";
import {
  fetchChannelRetention,
  fetchMemberPermissions,
  setChannelRetention,
  setMemberPermissions,
} from "./requests";

const feedback = service("feedback");

export const postingPrefs = defineQuery<ChannelId, ChannelPostingPrefs>({
  load: (id, { signal }) => fetchChannelPostingPrefs(id, signal),
  name: "channelPostingPrefs",
});
export const retention = defineQuery<ChannelId, number | null>({
  load: (id, { signal }) => fetchChannelRetention(id, signal),
  name: "channelRetention",
});
export const memberPermissions = defineQuery<ChannelId, Required<MemberPermissionsPatch>>({
  load: (id, { signal }) => fetchMemberPermissions(id, signal),
  name: "memberPermissions",
});

function withPostingPatch(
  prefs: ChannelPostingPrefs,
  patch: ChannelPostingPrefsPatch,
): ChannelPostingPrefs {
  if (!("posting" in patch)) return { ...prefs, ...patch };
  return {
    ...prefs,
    postingExceptionUserIds: patch.posting.exceptionUserIds,
    postingRestrictedToManagers: patch.posting.restrictedToManagers,
  };
}

export const savingPosting = defineMutation<{
  channelId: ChannelId;
  onFailure: (error: unknown) => void;
  patch: ChannelPostingPrefsPatch;
}>({
  key: ({ channelId }) => channelId,
  mode: "single",
  onError: (error, { onFailure }) => onFailure(error),
  optimistic: ({ channelId, patch }, transaction) =>
    transaction.apply(postingPrefs, channelId, (prefs) => withPostingPatch(prefs, patch)),
  run: ({ channelId, patch }) => setChannelPostingPrefs(channelId, patch),
});

export const savingRetention = defineMutation<{ channelId: ChannelId; days: number | null }>({
  key: ({ channelId }) => channelId,
  mode: "single",
  onError: (error, { channelId }) =>
    feedback.caught(channelId, error, "Failed to update message retention."),
  onSuccess: (_, { channelId, days }) => retention.set(channelId, days),
  run: ({ channelId, days }) => setChannelRetention(channelId, days),
});

export const savingPermissions = defineMutation<{
  channelId: ChannelId;
  patch: MemberPermissionsPatch;
}>({
  key: ({ channelId }) => channelId,
  mode: "single",
  onError: (error, { channelId }) =>
    feedback.caught(channelId, error, "Failed to update member permissions."),
  onSuccess: (_, { channelId, patch }) =>
    memberPermissions.modify(channelId, (current) => ({
      invite: patch.invite ?? current.invite,
      setPurpose: patch.setPurpose ?? current.setPurpose,
      setTopic: patch.setTopic ?? current.setTopic,
    })),
  run: ({ channelId, patch }) => setMemberPermissions(channelId, patch),
});
