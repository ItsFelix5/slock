import { defineQuery } from "@slock/plugins/query/client/api";
import { mapChannelDetails, mapUser, parseChannelId, parseUserId, replyError } from "@slock/slack";
import { apiGet, apiPost } from "@slock/slack/client";
import type {
  BrowsableChannel,
  ChannelDetails,
  ChannelId,
  ChannelMembersPage,
  RawChannel,
  RawUser,
  UserId,
} from "@slock/types";
import { mapBrowsableChannels } from "./search";

export {
  conversationView,
  fetchConversationView,
  invalidateConversationView,
} from "./conversationView";

export const channelMatches = defineQuery<string, BrowsableChannel[]>({
  load: (term, { signal }) => fetchBrowsableChannels(term, signal),
  maxAgeMs: 30_000,
  name: "channelMatches",
  revalidates: false,
});

async function fetchBrowsableChannels(
  query: string,
  signal: AbortSignal,
): Promise<BrowsableChannel[]> {
  const q = query.trim();
  if (!q) return [];
  const data = await apiGet<{ items?: RawChannel[] }>(
    `/api/channels/browse?query=${encodeURIComponent(q)}`,
    signal,
  );
  if (!data.ok) throw replyError(data, "search.modules.channels failed");
  return mapBrowsableChannels(data.items ?? []);
}

export async function fetchChannelInfo(
  channelId: ChannelId,
  signal?: AbortSignal,
): Promise<RawChannel> {
  const data = await apiGet<{ channel: RawChannel }>(`/api/channels/${channelId}`, signal);
  if (!data.ok) throw replyError(data, "conversations.info failed");
  return data.channel;
}
export async function fetchChannelDetails(channelId: ChannelId): Promise<ChannelDetails> {
  return mapChannelDetails(await fetchChannelInfo(channelId));
}
export async function fetchChannelMembers(
  channelId: ChannelId,
  filter: "everyone" | "apps",
  marker?: string,
  search?: string,
  signal?: AbortSignal,
): Promise<ChannelMembersPage> {
  const query = new URLSearchParams({ filter });
  if (marker) query.set("marker", marker);
  if (search) query.set("query", search);
  const data = await apiGet<{ next_marker?: string; results?: RawUser[] }>(
    `/api/channels/${channelId}/members?${query}`,
    signal,
  );
  if (!data.ok) throw replyError(data, "edge users/list failed");
  return {
    members: (data.results ?? []).filter((u) => !u.deleted).map(mapUser),
    nextCursor: data.next_marker || undefined,
  };
}
export async function fetchChannelManagerIds(
  channelId: ChannelId,
  signal?: AbortSignal,
): Promise<UserId[]> {
  const data = await apiGet<{ userIds?: string[] }>(`/api/channels/${channelId}/managers`, signal);
  if (!data.ok) throw replyError(data, "admin.roles.entity.listAssignments failed");
  return (data.userIds ?? []).map(parseUserId);
}

export async function openDm(userId: UserId): Promise<ChannelId | null> {
  const data = await apiPost<{ channel: { id: string } }>("/api/dms", { userId });
  if (!data.ok) return null;
  return parseChannelId(data.channel.id);
}
