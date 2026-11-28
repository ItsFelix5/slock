import type { CountsReply } from "@slock/plugins/slack/client/api/counts";
import { counts } from "@slock/plugins/slack/client/api/counts";
import { replyError } from "@slock/slack";
import { apiPost } from "@slock/slack/client";
import type { ChannelId, Ts } from "@slock/types";

export function fetchLatestCounts(): Promise<CountsReply> {
  return counts.refresh(null);
}

export async function markChannelRead(channelId: ChannelId, ts: Ts) {
  const data = await apiPost(`/api/channels/${channelId}/read`, { ts });
  if (!data.ok) throw replyError(data, "conversations.mark failed");
  return data;
}

export async function markThreadRead(channelId: ChannelId, threadTs: Ts, ts: Ts) {
  const data = await apiPost(`/api/channels/${channelId}/threads/${threadTs}/read`, { ts });
  if (!data.ok) throw replyError(data, "subscriptions.thread.mark failed");
  return data;
}
