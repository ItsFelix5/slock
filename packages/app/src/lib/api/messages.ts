import type { Message, PinnedMessage, RawMessage, SearchResult } from "@slock/types";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  getWorkspaceDomain,
  isMyRelayedMessage,
  mapMessage,
  mapVisibleMessage,
  mapVisibleMessages,
} from "@slock/types";
import { store } from "../store";

export { fetchHistory, fetchHistoryAround, fetchHistoryNewer } from "./messageHistory";

type HistoryReply = {
  has_more?: boolean;
  messages?: RawMessage[];
  response_metadata?: { next_cursor?: string };
};

export async function fetchReplies(channelId: string, threadTs: string): Promise<Message[]> {
  const messages: Message[] = [];
  let cursor: string | undefined;
  do {
    const query = new URLSearchParams({ limit: "200" });
    if (cursor) query.set("cursor", cursor);
    const data = await apiGet<HistoryReply>(
      `/api/channels/${channelId}/threads/${threadTs}/messages?${query}`,
    );
    if (!data.ok) throw new Error(data.error ?? "conversations.replies failed");
    messages.push(...mapVisibleMessages(data.messages ?? []));
    cursor = data.has_more ? data.response_metadata?.next_cursor || undefined : undefined;
  } while (cursor);
  return messages;
}

export async function fetchReplyWindow(
  channelId: string,
  threadTs: string,
  ts: string,
): Promise<Message[]> {
  const query = new URLSearchParams({ inclusive: "true", limit: "50", oldest: ts });
  const data = await apiGet<HistoryReply>(
    `/api/channels/${channelId}/threads/${threadTs}/messages?${query}`,
  );
  if (!data.ok) throw new Error(data.error ?? "conversations.replies failed");
  return mapVisibleMessages(data.messages ?? []);
}

export async function fetchPermalinkMessage(
  channelId: string,
  messageTs: string,
  threadTs: string,
): Promise<Message | undefined> {
  if (threadTs !== messageTs) {
    const replies = await fetchReplyWindow(channelId, threadTs, messageTs);
    return replies.find((m) => m.ts === messageTs);
  }
  const query = new URLSearchParams({
    inclusive: "true",
    latest: messageTs,
    limit: "1",
    oldest: messageTs,
  });
  const data = await apiGet<HistoryReply>(`/api/channels/${channelId}/messages?${query}`);
  if (!data.ok) throw new Error(data.error ?? "conversations.history failed");
  const raw = data.messages?.find((m) => m.ts === messageTs);
  return raw && mapVisibleMessage(raw);
}

export async function postMessage(
  channelId: string,
  text: string,
  threadTs?: string,
  blocks?: unknown,
  suppressUnfurl?: boolean,
  fileIds?: string[],
) {
  const body: Record<string, unknown> = { text };
  if (threadTs) body.threadTs = threadTs;
  if (blocks) body.blocks = blocks;
  if (suppressUnfurl) body.suppressUnfurl = true;
  if (fileIds?.length) body.fileIds = fileIds;
  const data = await apiPost<{ ts: string }>(`/api/channels/${channelId}/messages`, body);
  if (!data.ok) throw new Error(data.error ?? "chat.postMessage failed");
  return data;
}

export function isMine(msg: Message): boolean {
  const me = store.users.currentUser();
  return me?.id === msg.userId || isMyRelayedMessage(msg, me);
}

const BROADCAST_ERROR_MESSAGES: Record<string, string> = {
  bot_not_configured: "The broadcast bot isn't set up on this server.",
  org_user_not_in_team:
    "The broadcast bot's workspace doesn't include you, so @channel can't be relayed.",
  not_a_channel_manager: "Only channel managers can send @channel or @here here.",
};

export async function postBroadcastMessage(
  channelId: string,
  text: string,
  threadTs?: string,
  blocks?: unknown,
  suppressUnfurl?: boolean,
) {
  const body: Record<string, unknown> = { text };
  if (threadTs) body.threadTs = threadTs;
  if (blocks) body.blocks = blocks;
  if (suppressUnfurl) body.suppressUnfurl = true;
  const data = await apiPost<{ ts: string }>(`/api/channels/${channelId}/messages/broadcast`, body);
  if (!data.ok) {
    throw new Error(
      (data.error && BROADCAST_ERROR_MESSAGES[data.error]) ??
        data.error ??
        "chat.postMessage failed",
    );
  }
  return data;
}

export async function editMessage(
  channelId: string,
  ts: string,
  text: string,
  blocks?: unknown,
  relayed?: boolean,
  fileIds?: string[],
) {
  const body: Record<string, unknown> = { text };
  if (blocks) body.blocks = blocks;
  if (fileIds) body.fileIds = fileIds;
  if (relayed) body.relayed = true;
  const data = await apiPatch(`/api/channels/${channelId}/messages/${ts}`, body);
  if (!data.ok) throw new Error(data.error ?? "chat.update failed");
  return data;
}

export async function broadcastReply(channelId: string, ts: string, relayed?: boolean) {
  const body: Record<string, unknown> = { replyBroadcast: true };
  if (relayed) body.relayed = true;
  const data = await apiPatch(`/api/channels/${channelId}/messages/${ts}`, body);
  if (!data.ok) throw new Error(data.error ?? "chat.update failed");
  return data;
}

export async function deleteMessage(channelId: string, ts: string, relayed?: boolean) {
  const data = await apiDelete(
    `/api/channels/${channelId}/messages/${ts}`,
    relayed ? { relayed: true } : undefined,
  );
  if (!data.ok) throw new Error(data.error ?? "chat.delete failed");
  return data;
}

export async function toggleReaction(channelId: string, ts: string, name: string, remove: boolean) {
  const path = `/api/messages/${channelId}/${ts}/reactions`;
  const data = remove ? await apiDelete(path, { name }) : await apiPost(path, { name });
  if (!data.ok) throw new Error(data.error ?? "reactions failed");
  return data;
}

export async function toggleSaved(channelId: string, ts: string, remove: boolean) {
  const path = `/api/messages/${channelId}/${ts}/save`;
  const data = remove ? await apiDelete(path) : await apiPost(path);
  if (!data.ok) throw new Error(data.error ?? "saved.add/remove failed");
  return data;
}

export async function markChannelRead(channelId: string, ts: string) {
  const data = await apiPost(`/api/channels/${channelId}/read`, { ts });
  if (!data.ok) throw new Error(data.error ?? "conversations.mark failed");
  return data;
}

export async function toggleStar(channelId: string, remove: boolean) {
  const path = `/api/channels/${channelId}/star`;
  const data = remove ? await apiDelete(path) : await apiPost(path);
  if (!data.ok) throw new Error(data.error ?? "stars.add/remove failed");
  return data;
}

type PinsReply = { items?: { message?: RawMessage; ts: string }[] };

export async function fetchPins(channelId: string): Promise<string[]> {
  const data = await apiGet<PinsReply>(`/api/channels/${channelId}/pins`);
  if (!data.ok) throw new Error(data.error ?? "pins.list failed");
  return (data.items ?? []).map((it) => it.ts).filter(Boolean);
}

export async function fetchPinnedMessages(channelId: string): Promise<PinnedMessage[]> {
  const data = await apiGet<PinsReply>(`/api/channels/${channelId}/pins`);
  if (!data.ok) throw new Error(data.error ?? "pins.list failed");
  return (data.items ?? []).flatMap((it) =>
    it.message ? [{ message: mapMessage(it.message), ts: it.ts }] : [],
  );
}

export async function togglePin(channelId: string, ts: string, remove: boolean) {
  const path = `/api/messages/${channelId}/${ts}/pin`;
  const data = remove ? await apiDelete(path) : await apiPost(path);
  if (!data.ok) throw new Error(data.error ?? "pins.add/remove failed");
  return data;
}

export async function getChannelLink(channelId: string): Promise<string | null> {
  try {
    return `https://${await getWorkspaceDomain()}/archives/${channelId}`;
  } catch (err) {
    console.error("Failed to resolve workspace domain for link", err);
    return null;
  }
}

export async function getPermalink(
  channelId: string,
  ts: string,
  threadTs?: string,
): Promise<string | null> {
  const channelLink = await getChannelLink(channelId);
  if (!channelLink) return null;
  const base = `${channelLink}/p${ts.replace(".", "")}`;
  return threadTs && threadTs !== ts ? `${base}?thread_ts=${threadTs}&cid=${channelId}` : base;
}

export async function addReminder(text: string, time: string) {
  const data = await apiPost("/api/reminders", { text, time });
  if (!data.ok) throw new Error(data.error ?? "reminders.add failed");
  return data;
}

export async function addMessageReminder(channelId: string, ts: string, dateDue: number) {
  const data = await apiPost("/api/reminders", { channelId, dateDue, ts });
  if (!data.ok) throw new Error(data.error ?? "reminders.add failed");
  return data;
}

export async function searchMessages(
  query: string,
  opts?: { sort?: "score" | "timestamp"; sortDir?: "asc" | "desc" },
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ query });
  if (opts?.sort) params.set("sort", opts.sort);
  if (opts?.sortDir) params.set("sortDir", opts.sortDir);
  const data = await apiGet<{ results?: SearchResult[] }>(`/api/search/messages?${params}`);
  if (!data.ok) throw new Error(data.error ?? "search.messages failed");
  return data.results ?? [];
}
