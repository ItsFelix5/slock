import { apiDelete, apiPost } from "../../server";

export async function toggleThreadSubscription(
  channelId: string,
  threadTs: string,
  remove: boolean,
) {
  const path = `/api/channels/${channelId}/threads/${threadTs}/subscription`;
  const data = remove ? await apiDelete(path) : await apiPost(path);
  if (!data.ok) throw new Error(data.error ?? "subscriptions.thread.add/remove failed");
  return data;
}

export async function markThreadRead(channelId: string, threadTs: string, ts: string) {
  const data = await apiPost(`/api/channels/${channelId}/threads/${threadTs}/read`, { ts });
  if (!data.ok) throw new Error(data.error ?? "subscriptions.thread.mark failed");
  return data;
}
