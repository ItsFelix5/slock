// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
import { callSlack } from "../relay";

// Private endpoint behind the webapp's "Get notified about new replies" /
// "Unfollow thread" thread-menu actions — conversations.replies exposes the
// resulting state back as `subscribed` on the thread's root message.
export async function toggleThreadSubscription(
  channelId: string,
  threadTs: string,
  remove: boolean,
) {
  const data = await callSlack(
    remove ? "subscriptions.thread.remove" : "subscriptions.thread.add",
    {
      channel: channelId,
      thread_ts: threadTs,
    },
  );
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
  const data = await callSlack("subscriptions.thread.mark", {
    channel: channelId,
    thread_ts: threadTs,
    ts,
  });
  if (!data.ok) throw new Error(data.error ?? "subscriptions.thread.mark failed");
  return data;
}
