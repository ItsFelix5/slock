import {
  apiDelete,
  apiForm,
  apiGet,
  apiPatch,
  apiPost,
  getWorkspaceDomain,
  mapAttachment,
  mapMessage,
  mapVisibleMessage,
} from "@slock/slack";
import type { Message, PinnedMessage, RawAttachment, RawMessage, SearchResult } from "@slock/types";

import { uploadFilesForEdit } from "./content";
import { fetchRepliesFrom } from "./threadReplies";

export { fetchHistory, fetchHistoryAround, fetchHistoryNewer } from "./messageHistory";

type HistoryReply = {
  has_more?: boolean;
  messages?: RawMessage[];
  response_metadata?: { next_cursor?: string };
};

export async function fetchPermalinkMessage(
  channelId: string,
  messageTs: string,
  threadTs: string,
): Promise<Message | undefined> {
  if (threadTs !== messageTs) {
    const replies = await fetchRepliesFrom(channelId, threadTs, messageTs);
    return replies.messages.find((m) => m.ts === messageTs);
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

export async function fetchLinkPreview(channelId: string, url: string) {
  const data = await apiPost<{ attachment?: RawAttachment }>(`/api/channels/${channelId}/unfurl`, {
    url,
  });
  if (!data.ok) throw new Error(data.error ?? "chat.unfurlLink failed");
  return data.attachment && mapAttachment(data.attachment);
}

export async function postMessage(
  channelId: string,
  text: string,
  unfurl: string[],
  threadTs?: string,
  blocks?: unknown,
  fileIds?: string[],
) {
  const body: Record<string, unknown> = { text, unfurl };
  if (threadTs) body.threadTs = threadTs;
  if (blocks) body.blocks = blocks;
  if (fileIds?.length) body.fileIds = fileIds;
  const data = await apiPost<{ ts: string }>(`/api/channels/${channelId}/messages`, body);
  if (!data.ok) throw new Error(data.error ?? "chat.postMessage failed");
  return data;
}

const RELAY_TOKEN_HELP = "Run /slock-relay token in Slack and paste it in Settings > Account.";

const RELAY_ERROR_MESSAGES: Record<string, string> = {
  invalid_token: `Your relay token is no longer valid. ${RELAY_TOKEN_HELP}`,
  org_user_not_in_team:
    "The broadcast bot's workspace doesn't include you, so @channel can't be relayed.",
  relay_token_required: `Sending files with @channel needs a relay token. ${RELAY_TOKEN_HELP}`,
};

export class RelayError extends Error {}

function relayFailure(error: string | undefined, fallback: string) {
  const friendly = error && RELAY_ERROR_MESSAGES[error];
  return friendly ? new RelayError(friendly) : new Error(error ?? fallback);
}

type UploadProgress = (fileIndex: number, fraction: number) => void;

function perFileProgress(files: File[], onProgress?: UploadProgress) {
  if (!onProgress) return;
  const total = files.reduce((sum, file) => sum + file.size, 0) || 1;
  return (fraction: number) => {
    let before = 0;
    files.forEach((file, index) => {
      const share = file.size ? (fraction * total - before) / file.size : fraction;
      onProgress(index, Math.min(1, Math.max(0, share)));
      before += file.size;
    });
  };
}

function sendRelay<T extends object>(
  method: "PATCH" | "POST",
  path: string,
  fields: object,
  files: File[] = [],
  onProgress?: UploadProgress,
) {
  if (!files.length)
    return method === "POST" ? apiPost<T>(path, fields) : apiPatch<T>(path, fields);
  const form = new FormData();
  form.append("payload", JSON.stringify(fields));
  for (const file of files) form.append("files", file, file.name);
  return apiForm<T>(method, path, form, perFileProgress(files, onProgress));
}

export async function postBroadcastMessage(
  channelId: string,
  text: string,
  unfurl: string[] | undefined,
  threadTs?: string,
  blocks?: unknown,
  files?: File[],
  onProgress?: UploadProgress,
) {
  const body: Record<string, unknown> = { text, unfurl };
  if (threadTs) body.threadTs = threadTs;
  if (blocks) body.blocks = blocks;
  const path = `/api/channels/${channelId}/messages/broadcast`;
  const data = await sendRelay<{ ts: string }>("POST", path, body, files, onProgress);
  if (!data.ok) throw relayFailure(data.error, "chat.postMessage failed");
  return data;
}

export async function editMessage(
  channelId: string,
  ts: string,
  text: string,
  blocks?: unknown,
  options: { relayed?: boolean; fileIds?: string[]; files?: File[] } = {},
) {
  const { relayed, fileIds, files = [] } = options;
  const body: Record<string, unknown> = { text };
  if (blocks) body.blocks = blocks;
  const path = `/api/channels/${channelId}/messages/${ts}`;
  if (relayed) {
    const data = await sendRelay("PATCH", path, { ...body, fileIds, relayed }, files);
    if (!data.ok) throw relayFailure(data.error, "chat.update failed");
    return data;
  }
  const uploaded = files.length ? await uploadFilesForEdit(files.map((file) => ({ file }))) : [];
  if (fileIds || uploaded.length) body.fileIds = [...(fileIds ?? []), ...uploaded.map((f) => f.id)];
  const data = await apiPatch(path, body);
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

export async function deleteAttachment(channelId: string, ts: string, attachmentId: number) {
  const data = await apiDelete(
    `/api/channels/${channelId}/messages/${ts}/attachments/${attachmentId}`,
  );
  if (!data.ok) throw new Error(data.error ?? "chat.deleteAttachment failed");
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

export async function saveWithReminder(channelId: string, ts: string, dateDue: number) {
  const data = await apiPost(`/api/messages/${channelId}/${ts}/reminder`, { dateDue });
  if (!data.ok) throw new Error(data.error ?? "saved.add failed");
  return data;
}

export async function updateSaved(channelId: string, ts: string, change: { dateDue: number }) {
  const data = await apiPatch(`/api/messages/${channelId}/${ts}/save`, change);
  if (!data.ok) throw new Error(data.error ?? "saved.update failed");
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
