import type { ActivityItem, Message } from "../types";
import { HIDE_SUBTYPES, mapMessage } from "./mappers";
import { callSlack, getWorkspaceDomain } from "./relay";

export type HistoryPage = { messages: Message[]; hasMore: boolean; nextCursor?: string };

// `cursor` (from a prior page's nextCursor) fetches the next page of messages
// older than that page — conversations.history paginates backwards in time.
export async function fetchHistory(channelId: string, cursor?: string): Promise<HistoryPage> {
  const params: Record<string, string> = { channel: channelId, limit: "60" };
  if (cursor) params.cursor = cursor;
  const data = await callSlack("conversations.history", params);
  if (!data.ok) throw new Error(data.error ?? "conversations.history failed");
  const messages: any[] = data.messages ?? [];
  return {
    hasMore: !!data.has_more,
    messages: messages
      .filter((m) => m.type === "message" && !HIDE_SUBTYPES.has(m.subtype))
      .map(mapMessage)
      .reverse(),
    nextCursor: data.response_metadata?.next_cursor || undefined,
  };
}

export async function fetchReplies(channelId: string, threadTs: string): Promise<Message[]> {
  const data = await callSlack("conversations.replies", {
    channel: channelId,
    limit: "200",
    ts: threadTs,
  });
  if (!data.ok) throw new Error(data.error ?? "conversations.replies failed");
  const messages: any[] = data.messages ?? [];
  return messages
    .filter((m) => m.type === "message" && !HIDE_SUBTYPES.has(m.subtype))
    .map(mapMessage);
}

export async function postMessage(
  channelId: string,
  text: string,
  threadTs?: string,
  blocks?: unknown,
  suppressUnfurl?: boolean,
) {
  const params: Record<string, string> = { channel: channelId, text };
  if (threadTs) params.thread_ts = threadTs;
  if (blocks) params.blocks = JSON.stringify(blocks);
  // Slack's own link unfurl is all-or-nothing for the whole message — there's
  // no documented way to suppress just one link — so dismissing any preview
  // in the composer turns it off for the message as a whole.
  if (suppressUnfurl) {
    params.unfurl_links = "false";
    params.unfurl_media = "false";
  }
  const data = await callSlack("chat.postMessage", params);
  if (!data.ok) throw new Error(data.error ?? "chat.postMessage failed");
  return data;
}

export async function editMessage(channelId: string, ts: string, text: string, blocks?: unknown) {
  const params: Record<string, string> = { channel: channelId, text, ts };
  if (blocks) params.blocks = JSON.stringify(blocks);
  const data = await callSlack("chat.update", params);
  if (!data.ok) throw new Error(data.error ?? "chat.update failed");
  return data;
}

export async function broadcastReply(channelId: string, ts: string) {
  const data = await callSlack("chat.update", { channel: channelId, reply_broadcast: "true", ts });
  if (!data.ok) throw new Error(data.error ?? "chat.update failed");
  return data;
}

export async function deleteMessage(channelId: string, ts: string) {
  const data = await callSlack("chat.delete", { channel: channelId, ts });
  if (!data.ok) throw new Error(data.error ?? "chat.delete failed");
  return data;
}

export async function toggleReaction(channelId: string, ts: string, name: string, remove: boolean) {
  const data = await callSlack(remove ? "reactions.remove" : "reactions.add", {
    channel: channelId,
    name,
    timestamp: ts,
  });
  if (!data.ok) throw new Error(data.error ?? "reactions failed");
  return data;
}

export async function toggleSaved(channelId: string, ts: string, remove: boolean) {
  const data = await callSlack(remove ? "saved.delete" : "saved.add", {
    item_id: channelId,
    item_type: "message",
    ts,
  });
  if (!data.ok) throw new Error(data.error ?? "saved.add/remove failed");
  return data;
}

export function markChannelRead(channelId: string, ts: string) {
  return callSlack("conversations.mark", { channel: channelId, ts });
}

export async function toggleStar(channelId: string, remove: boolean) {
  const data = await callSlack(remove ? "stars.remove" : "stars.add", { channel: channelId });
  if (!data.ok) throw new Error(data.error ?? "stars.add/remove failed");
  return data;
}

export async function fetchPins(channelId: string): Promise<string[]> {
  const data = await callSlack("pins.list", { channel: channelId });
  if (!data.ok) return [];
  const items: any[] = data.items ?? [];
  return items.map((it) => it.message?.ts ?? it.created ?? it.channel).filter(Boolean);
}

export interface PinnedMessage {
  message: Message | null;
  ts: string;
}

export async function fetchPinnedMessages(channelId: string): Promise<PinnedMessage[]> {
  const data = await callSlack("pins.list", { channel: channelId });
  if (!data.ok) return [];
  const items: any[] = data.items ?? [];
  return items
    .filter((it) => it.type === "message" && it.message)
    .map((it) => ({ message: mapMessage(it.message), ts: it.message.ts }));
}

export async function togglePin(channelId: string, ts: string, remove: boolean) {
  const data = await callSlack(remove ? "pins.remove" : "pins.add", {
    channel: channelId,
    timestamp: ts,
  });
  if (!data.ok) throw new Error(data.error ?? "pins.add/remove failed");
  return data;
}

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

// `chat.getPermalink` is blocked with `enterprise_is_restricted` on Enterprise
// Grid workspaces like this one, so the permalink is built locally instead —
// it's a plain, documented URL shape (workspace domain + channel + ts with
// its "." removed and a "p" prefix), no API call needed. `threadTs` (when the
// target is a reply within a thread) adds the same `thread_ts` query param
// Slack's own permalinks use, so opening the link deep-links into the thread
// instead of just the parent channel.
export async function getPermalink(
  channelId: string,
  ts: string,
  threadTs?: string,
): Promise<string | null> {
  try {
    const domain = await getWorkspaceDomain();
    const base = `https://${domain}/archives/${channelId}/p${ts.replace(".", "")}`;
    return threadTs && threadTs !== ts ? `${base}?thread_ts=${threadTs}&cid=${channelId}` : base;
  } catch (err) {
    console.error("Failed to resolve workspace domain for permalink", err);
    return null;
  }
}

export async function addReminder(text: string, time: string) {
  const data = await callSlack("reminders.add", { text, time });
  if (!data.ok) throw new Error(data.error ?? "reminders.add failed");
  return data;
}

export interface SearchResult {
  channelId: string;
  channelName: string;
  text: string;
  ts: string;
  userId: string;
}

export async function searchMessages(
  query: string,
  opts?: { sort?: "score" | "timestamp"; sortDir?: "asc" | "desc" },
): Promise<SearchResult[]> {
  const data = await callSlack("search.messages", {
    count: "40",
    query,
    sort: opts?.sort ?? "timestamp",
    sort_dir: opts?.sortDir ?? "desc",
  });
  if (!data.ok) return [];
  const matches: any[] = data.messages?.matches ?? [];
  return matches.map((m) => ({
    channelId: m.channel?.id,
    channelName: m.channel?.name,
    text: m.text ?? "",
    ts: m.ts,
    userId: m.user,
  }));
}

export async function fetchMentions(selfUserId: string): Promise<ActivityItem[]> {
  const data = await callSlack("search.messages", {
    count: "40",
    query: `<@${selfUserId}>`,
    sort: "timestamp",
    sort_dir: "desc",
  });
  if (!data.ok) return [];
  const matches: any[] = data.messages?.matches ?? [];
  return matches.map((m) => ({
    channelId: m.channel?.id,
    id: `${m.channel?.id}-${m.ts}`,
    kind: "mention" as const,
    text: m.text ?? "",
    time: parseFloat(m.ts) * 1000,
    ts: m.ts,
    userId: m.user,
  }));
}
