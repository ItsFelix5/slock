import { createBatchLoader } from "@slock/resource";
import { mapChannel, replyError } from "@slock/slack";
import { apiDelete, apiPost, apiPut } from "@slock/slack/client";
import type { Channel, ChannelId, RawChannel } from "@slock/types";

const MAX_CHANNELS_PER_BATCH = 100;

export const fetchChannel = createBatchLoader<Channel | null>({
  load: async (ids) => {
    const data = await apiPost<{ channels?: Record<string, RawChannel | null> }>(
      "/api/channels/lookup",
      { ids },
    );
    if (!data.ok) throw replyError(data, "edge channels/info failed");
    const channels = data.channels ?? {};
    return new Map(ids.map((id) => [id, channels[id] ? mapChannel(channels[id]) : null]));
  },
  maxBatch: MAX_CHANNELS_PER_BATCH,
});

export async function joinChannel(channelId: ChannelId): Promise<Channel> {
  const data = await apiPost<{ channel: RawChannel }>(`/api/channels/${channelId}/join`);
  if (!data.ok) throw replyError(data, "conversations.join failed");
  return mapChannel(data.channel);
}

export async function leaveChannel(channelId: ChannelId) {
  const data = await apiPost(`/api/channels/${channelId}/leave`);
  if (!data.ok) throw replyError(data, "conversations.leave failed");
  return data;
}

export async function toggleStar(channelId: ChannelId, remove: boolean) {
  const path = `/api/channels/${channelId}/star`;
  const data = remove ? await apiDelete(path) : await apiPost(path);
  if (!data.ok) throw replyError(data, "stars.add/remove failed");
  return data;
}

export async function setChannelSectionsPreference(
  sections: Record<string, Record<string, unknown>>,
): Promise<void> {
  const data = await apiPut("/api/preferences/channel-sections", { sections });
  if (!data.ok) throw replyError(data, "users.prefs.set channel_sections failed");
}
