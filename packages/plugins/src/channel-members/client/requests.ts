import { parseUserId, replyError } from "@slock/slack";
import { apiDelete, apiGet, apiPost } from "@slock/slack/client";
import type { ChannelId, UserId } from "@slock/types";

export interface ChannelPeople {
  complete: boolean;
  ids: UserId[];
}

export async function fetchPeopleCount(channelId: ChannelId, signal: AbortSignal) {
  const data = await apiGet<{ people?: number }>(`/api/channels/${channelId}/people-count`, signal);
  if (!data.ok) throw replyError(data, "edge users/counts failed");
  return data.people ?? null;
}

export async function fetchPeople(
  channelId: ChannelId,
  signal: AbortSignal,
): Promise<ChannelPeople> {
  const data = await apiGet<{ complete?: boolean; ids?: string[] }>(
    `/api/channels/${channelId}/people`,
    signal,
  );
  if (!data.ok) throw replyError(data, "edge users/list failed");
  return { complete: !!data.complete, ids: (data.ids ?? []).map(parseUserId) };
}

export async function addChannelManager(channelId: ChannelId, userId: UserId): Promise<void> {
  const data = await apiPost(`/api/channels/${channelId}/managers`, { userId });
  if (!data.ok) throw replyError(data, "admin.roles.addMembers failed");
}

export async function inviteToChannel(channelId: ChannelId, userIds: UserId[]): Promise<void> {
  const data = await apiPost(`/api/channels/${channelId}/members`, { userIds });
  if (!data.ok) throw replyError(data, "conversations.invite failed");
}

export async function removeFromChannel(channelId: ChannelId, userId: UserId): Promise<void> {
  const data = await apiDelete(`/api/channels/${channelId}/members/${userId}`);
  if (!data.ok) throw replyError(data, "conversations.kick failed");
}
