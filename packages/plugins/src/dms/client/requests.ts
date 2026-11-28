import { replyError } from "@slock/slack";
import { apiPost } from "@slock/slack/client";
import type { ChannelId, RawChannel, UserId } from "@slock/types";

export async function addGroupDmPeople(
  channelId: ChannelId,
  userIds: UserId[],
  historyStartTs?: string,
): Promise<RawChannel> {
  const data = await apiPost<{ channel: RawChannel }>(`/api/dms/${channelId}/members`, {
    historyStartTs,
    userIds,
  });
  if (!data.ok) throw replyError(data, "conversations.createChild failed");
  return data.channel;
}

export async function closeDm(channelId: ChannelId) {
  const data = await apiPost(`/api/channels/${channelId}/close`);
  if (!data.ok) throw replyError(data, "conversations.close failed");
  return data;
}
