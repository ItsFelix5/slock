import { apiDelete, apiPost } from "../../server";

// Private endpoint behind the webapp's "Get notified about new replies" /
// "Unfollow thread" thread-menu actions — conversations.replies exposes the
// resulting state back as `subscribed` on the thread's root message.
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

// Threads have their own server-side unread/badge state, separate from the
// channel's read cursor that conversations.mark (markChannelRead) advances —
// that's why a thread reappears unread (activity feed, thread_v2 badge count)
// even after its channel has been marked read. subscriptions.thread.mark
// clears that thread-specific state, mirroring toggleThreadSubscription's
// shape (channel + thread_ts) above.
export async function markThreadRead(channelId: string, threadTs: string, ts: string) {
  const data = await apiPost(`/api/channels/${channelId}/threads/${threadTs}/read`, { ts });
  if (!data.ok) throw new Error(data.error ?? "subscriptions.thread.mark failed");
  return data;
}
