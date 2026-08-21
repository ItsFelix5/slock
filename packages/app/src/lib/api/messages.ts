import type { Message, PinnedMessage, SearchResult } from "@slock/types";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  getWorkspaceDomain,
  HIDE_SUBTYPES,
  mapMessage,
} from "@slock/types";

export { fetchHistory, fetchHistoryAround, fetchHistoryNewer } from "./messageHistory";

export async function fetchReplies(
  channelId: string,
  threadTs: string,
  options?: { untilTs?: string },
): Promise<Message[]> {
  const messages: Message[] = [];
  let cursor: string | undefined;
  for (;;) {
    const query = new URLSearchParams({ limit: "200" });
    if (cursor) query.set("cursor", cursor);
    const data = await apiGet(`/api/channels/${channelId}/threads/${threadTs}/messages?${query}`);
    if (!data.ok) throw new Error(data.error ?? "conversations.replies failed");
    const raw: any[] = data.messages ?? [];
    messages.push(
      ...raw.filter((m) => m.type === "message" && !HIDE_SUBTYPES.has(m.subtype)).map(mapMessage),
    );
    const nextCursor = data.response_metadata?.next_cursor || undefined;
    if (!(data.has_more && nextCursor)) return messages;
    if (options?.untilTs && messages.some((m) => m.ts === options.untilTs)) return messages;
    cursor = nextCursor;
  }
}

export async function fetchPermalinkMessage(
  channelId: string,
  messageTs: string,
  threadTs: string,
): Promise<Message | undefined> {
  if (threadTs !== messageTs) {
    const replies = await fetchReplies(channelId, threadTs, {
      untilTs: messageTs,
    });
    return replies.find((m) => m.ts === messageTs);
  }
  const query = new URLSearchParams({
    inclusive: "true",
    latest: messageTs,
    limit: "1",
    oldest: messageTs,
  });
  const data = await apiGet(`/api/channels/${channelId}/messages?${query}`);
  if (!data.ok) throw new Error(data.error ?? "conversations.history failed");
  const messages: any[] = data.messages ?? [];
  const raw = messages.find((m) => m.ts === messageTs);
  return raw && !HIDE_SUBTYPES.has(raw.subtype) ? mapMessage(raw) : undefined;
}

export async function postMessage(
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
  const data = await apiPost(`/api/channels/${channelId}/messages`, body);
  if (!data.ok) throw new Error(data.error ?? "chat.postMessage failed");
  return data;
}

export async function editMessage(channelId: string, ts: string, text: string, blocks?: unknown) {
  const body: Record<string, unknown> = { text };
  if (blocks) body.blocks = blocks;
  const data = await apiPatch(`/api/channels/${channelId}/messages/${ts}`, body);
  if (!data.ok) throw new Error(data.error ?? "chat.update failed");
  return data;
}

export async function broadcastReply(channelId: string, ts: string) {
  const data = await apiPatch(`/api/channels/${channelId}/messages/${ts}`, {
    replyBroadcast: true,
  });
  if (!data.ok) throw new Error(data.error ?? "chat.update failed");
  return data;
}

export async function deleteMessage(channelId: string, ts: string) {
  const data = await apiDelete(`/api/channels/${channelId}/messages/${ts}`);
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

export async function fetchPins(channelId: string): Promise<string[]> {
  const data = await apiGet(`/api/channels/${channelId}/pins`);
  if (!data.ok) throw new Error(data.error ?? "pins.list failed");
  const items: any[] = data.items ?? [];
  return items.map((it) => it.ts).filter(Boolean);
}

export async function fetchPinnedMessages(channelId: string): Promise<PinnedMessage[]> {
  const data = await apiGet(`/api/channels/${channelId}/pins`);
  if (!data.ok) throw new Error(data.error ?? "pins.list failed");
  const items: any[] = data.items ?? [];
  return items
    .filter((it) => it.message)
    .map((it) => ({ message: mapMessage(it.message), ts: it.ts }));
}

export async function togglePin(channelId: string, ts: string, remove: boolean) {
  const path = `/api/messages/${channelId}/${ts}/pin`;
  const data = remove ? await apiDelete(path) : await apiPost(path);
  if (!data.ok) throw new Error(data.error ?? "pins.add/remove failed");
  return data;
}

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
  const data = await apiGet(`/api/search/messages?${params}`);
  if (!data.ok) throw new Error(data.error ?? "search.messages failed");
  return data.results ?? [];
}

export async function fetchSearchAutocomplete(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  const data = await apiGet(`/api/search/autocomplete?query=${encodeURIComponent(query)}`);
  if (!data.ok) return [];
  return data.suggestions ?? [];
}
