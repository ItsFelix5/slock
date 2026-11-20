import { apiDelete, apiPost } from "@slock/slack";
import type { ChannelId, Ts } from "@slock/types";

export async function toggleThreadSubscription(
  channelId: ChannelId,
  threadTs: Ts,
  remove: boolean,
) {
  const path = `/api/channels/${channelId}/threads/${threadTs}/subscription`;
  const data = remove ? await apiDelete(path) : await apiPost(path);
  if (!data.ok) throw new Error(data.error ?? "subscriptions.thread.add/remove failed");
  return data;
}

export async function markThreadRead(channelId: ChannelId, threadTs: Ts, ts: Ts) {
  const data = await apiPost(`/api/channels/${channelId}/threads/${threadTs}/read`, { ts });
  if (!data.ok) throw new Error(data.error ?? "subscriptions.thread.mark failed");
  return data;
}
