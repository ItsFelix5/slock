import { replyError } from "@slock/slack";
import { apiPatch, apiPost, apiPut } from "@slock/slack/client";
import type { ChannelId } from "@slock/types";

export async function renameChannel(channelId: ChannelId, name: string): Promise<string> {
  const data = await apiPatch<{ channel?: { name?: string } }>(`/api/channels/${channelId}`, {
    name,
  });
  if (!data.ok) throw replyError(data, "conversations.rename failed");
  return data.channel?.name ?? name;
}

export async function setChannelPurpose(channelId: ChannelId, purpose: string): Promise<void> {
  const data = await apiPut(`/api/channels/${channelId}/purpose`, { purpose });
  if (!data.ok) throw replyError(data, "conversations.setPurpose failed");
}

export async function archiveChannel(channelId: ChannelId): Promise<void> {
  const data = await apiPost(`/api/channels/${channelId}/archive`);
  if (!data.ok) throw replyError(data, "conversations.archive failed");
}

export async function unarchiveChannel(channelId: ChannelId): Promise<void> {
  const data = await apiPost(`/api/channels/${channelId}/unarchive`);
  if (!data.ok) throw replyError(data, "conversations.unarchive failed");
}

export async function convertChannelToPrivate(
  channelId: ChannelId,
  groupDmName?: string,
): Promise<void> {
  const data = await apiPost(`/api/channels/${channelId}/convert-to-private`, {
    name: groupDmName,
  });
  if (!data.ok) throw replyError(data, "conversations.convertToPrivate failed");
}

export async function setChannelTopic(channelId: ChannelId, topic: string): Promise<void> {
  const data = await apiPut(`/api/channels/${channelId}/topic`, { topic });
  if (!data.ok) throw replyError(data, "conversations.setTopic failed");
}
