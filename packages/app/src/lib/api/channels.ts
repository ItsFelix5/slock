import type {
  BrowsableChannel,
  Channel,
  ChannelDetails,
  ChannelFilesAndLinks,
  ChannelMembersPage,
  MemberPermissionsPatch,
  RawChannel,
  RawFile,
  RawLink,
  RawUser,
} from "@slock/types";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  mapChannel,
  mapChannelDetails,
  mapFile,
  mapLink,
  mapUser,
} from "@slock/types";
import { createBatchedIdFetcher } from "./cache/batchedIdFetcher";
import { mapBrowsableChannels } from "./search";

export {
  createSection,
  deleteSection,
  fetchFreshSections,
  fetchSections,
  openDm,
  renameSection,
  reorderSection,
  setChannelNotifyAll,
  updateSectionChannels,
} from "./channels/sections";
export { fetchChannelCanvases, fetchConversationView } from "./conversationView";
export { PairedPreferenceWriteError } from "./preferences/pairedPreferenceWrite";

const MAX_CHANNELS_PER_BATCH = 100;

export const fetchChannel = createBatchedIdFetcher<Channel | null>(async (ids) => {
  const data = await apiPost<{ channels?: Record<string, RawChannel | null> }>(
    "/api/channels/lookup",
    { ids },
  );
  if (!data.ok) throw new Error(data.error ?? "edge channels/info failed");
  const channels = data.channels ?? {};
  return new Map(ids.map((id) => [id, channels[id] ? mapChannel(channels[id]) : null]));
}, MAX_CHANNELS_PER_BATCH);

export async function reportChannelNamesToFlaron(names: string[]): Promise<void> {
  const data = await apiPost("/api/channels/flaron-report", { names });
  if (!data.ok) throw new Error(data.error ?? "flaron-report failed");
}

export async function fetchBrowsableChannels(query: string): Promise<BrowsableChannel[]> {
  const q = query.trim();
  if (!q) return [];
  const data = await apiGet<{ items?: RawChannel[] }>(
    `/api/channels/browse?query=${encodeURIComponent(q)}`,
  );
  if (!data.ok) throw new Error(data.error ?? "search.modules.channels failed");
  return mapBrowsableChannels(data.items ?? []);
}

export async function searchChannelFilesAndLinks(
  channelId: string,
  channelName: string,
  query: string,
  page = 1,
): Promise<ChannelFilesAndLinks> {
  const params = new URLSearchParams({
    channelName,
    page: String(page),
    query,
  });
  const data = await apiGet<{
    files?: RawFile[];
    filesTotal?: number;
    hasMore?: boolean;
    links?: RawLink[];
    linksTotal?: number;
  }>(`/api/channels/${channelId}/files-links?${params}`);
  if (!data.ok) throw new Error(data.error ?? "channel files & links search failed");
  const files = data.files ?? [];
  const links = data.links ?? [];
  return {
    files: files.map(mapFile),
    filesTotal: data.filesTotal ?? files.length,
    hasMore: !!data.hasMore,
    links: links.map(mapLink),
    linksTotal: data.linksTotal ?? links.length,
  };
}

export async function fetchChannelLastRead(channelId: string): Promise<number> {
  const data = await apiGet<{ channel: RawChannel }>(`/api/channels/${channelId}`);
  if (!data.ok) throw new Error(data.error ?? "conversations.info failed");
  return (parseFloat(data.channel.last_read ?? "") || 0) * 1000;
}
export async function fetchChannelDetails(channelId: string): Promise<ChannelDetails> {
  const data = await apiGet<{ channel: RawChannel }>(`/api/channels/${channelId}`);
  if (!data.ok) throw new Error(data.error ?? "conversations.info failed");
  return mapChannelDetails(data.channel);
}
export async function fetchChannelMembers(
  channelId: string,
  filter: "everyone" | "apps",
  marker?: string,
  search?: string,
): Promise<ChannelMembersPage> {
  const query = new URLSearchParams({ filter });
  if (marker) query.set("marker", marker);
  if (search) query.set("query", search);
  const data = await apiGet<{ next_marker?: string; results?: RawUser[] }>(
    `/api/channels/${channelId}/members?${query}`,
  );
  if (!data.ok) throw new Error(data.error ?? "edge users/list failed");
  return {
    members: (data.results ?? []).filter((u) => !u.deleted).map(mapUser),
    nextCursor: data.next_marker || undefined,
  };
}
export async function fetchChannelManagerIds(channelId: string): Promise<string[]> {
  const data = await apiGet<{ userIds?: string[] }>(`/api/channels/${channelId}/managers`);
  if (!data.ok) throw new Error(data.error ?? "admin.roles.entity.listAssignments failed");
  return data.userIds ?? [];
}
export async function inviteToChannel(channelId: string, userIds: string[]): Promise<void> {
  const data = await apiPost(`/api/channels/${channelId}/members`, { userIds });
  if (!data.ok) throw new Error(data.error ?? "conversations.invite failed");
}
export async function removeFromChannel(channelId: string, userId: string): Promise<void> {
  const data = await apiDelete(`/api/channels/${channelId}/members/${userId}`);
  if (!data.ok) throw new Error(data.error ?? "conversations.kick failed");
}
export async function renameChannel(channelId: string, name: string): Promise<string> {
  const data = await apiPatch<{ channel?: { name?: string } }>(`/api/channels/${channelId}`, {
    name,
  });
  if (!data.ok) throw new Error(data.error ?? "conversations.rename failed");
  return data.channel?.name ?? name;
}
export async function setChannelPurpose(channelId: string, purpose: string): Promise<void> {
  const data = await apiPut(`/api/channels/${channelId}/purpose`, { purpose });
  if (!data.ok) throw new Error(data.error ?? "conversations.setPurpose failed");
}

export {
  fetchChannelPostingPrefs,
  parseChannelPostingPrefs,
  serializeChannelPostingPrefsPatch,
  setChannelPostingPrefs,
} from "./channelPostingPrefs";

export async function fetchChannelRetention(channelId: string): Promise<number | null> {
  const data = await apiGet<{ days?: number | null }>(`/api/channels/${channelId}/retention`);
  if (!data.ok) throw new Error(data.error ?? "conversations.getRetention failed");
  return data.days ?? null;
}
export async function setChannelRetention(channelId: string, days: number | null): Promise<void> {
  const data = await apiPut(`/api/channels/${channelId}/retention`, { days });
  if (!data.ok) throw new Error(data.error ?? "conversations.setRetention failed");
}
export function serializeMemberPermissionsPatch(patch: MemberPermissionsPatch): {
  is_allowed: boolean;
  permission: string;
}[] {
  const permissions: { is_allowed: boolean; permission: string }[] = [];
  if (patch.invite !== undefined) {
    permissions.push({
      is_allowed: patch.invite,
      permission: "INVITE_TO_CHANNEL",
    });
  }
  if (patch.setPurpose !== undefined) {
    permissions.push({
      is_allowed: patch.setPurpose,
      permission: "SET_CHANNEL_PURPOSE",
    });
  }
  if (patch.setTopic !== undefined) {
    permissions.push({
      is_allowed: patch.setTopic,
      permission: "SET_CHANNEL_TOPIC",
    });
  }
  return permissions;
}

export async function setMemberPermissions(
  channelId: string,
  patch: MemberPermissionsPatch,
): Promise<void> {
  const permissions = serializeMemberPermissionsPatch(patch);
  if (permissions.length === 0) return;
  const data = await apiPut(`/api/channels/${channelId}/member-permissions`, {
    permissions,
  });
  if (!data.ok) throw new Error(data.error ?? "conversations.permissions.accountTypes.set failed");
}
export async function joinChannel(channelId: string): Promise<Channel> {
  const data = await apiPost<{ channel: RawChannel }>(`/api/channels/${channelId}/join`);
  if (!data.ok) throw new Error(data.error ?? "conversations.join failed");
  return mapChannel(data.channel);
}
export async function createChannel(name: string, isPrivate: boolean): Promise<Channel> {
  const data = await apiPost<{ channel: RawChannel }>("/api/channels", { isPrivate, name });
  if (!data.ok) throw new Error(data.error ?? "conversations.create failed");
  return mapChannel(data.channel);
}
export async function leaveChannel(channelId: string) {
  const data = await apiPost(`/api/channels/${channelId}/leave`);
  if (!data.ok) throw new Error(data.error ?? "conversations.leave failed");
  return data;
}
export async function archiveChannel(channelId: string): Promise<void> {
  const data = await apiPost(`/api/channels/${channelId}/archive`);
  if (!data.ok) throw new Error(data.error ?? "conversations.archive failed");
}
export async function unarchiveChannel(channelId: string): Promise<void> {
  const data = await apiPost(`/api/channels/${channelId}/unarchive`);
  if (!data.ok) throw new Error(data.error ?? "conversations.unarchive failed");
}
export async function convertChannelToPrivate(channelId: string): Promise<void> {
  const data = await apiPost(`/api/channels/${channelId}/convert-to-private`);
  if (!data.ok) throw new Error(data.error ?? "conversations.convertToPrivate failed");
}
export async function closeDm(channelId: string) {
  const data = await apiPost(`/api/channels/${channelId}/close`);
  if (!data.ok) throw new Error(data.error ?? "conversations.close failed");
  return data;
}
export async function setChannelTopic(channelId: string, topic: string): Promise<void> {
  const data = await apiPut(`/api/channels/${channelId}/topic`, { topic });
  if (!data.ok) throw new Error(data.error ?? "conversations.setTopic failed");
}
