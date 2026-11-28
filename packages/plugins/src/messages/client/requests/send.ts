import type { PostedDraft } from "@slock/plugins/slack/client/api/messages";
import { parseTs, replyError } from "@slock/slack";
import { apiDelete, apiPatch, apiPost } from "@slock/slack/client";
import type { ChannelId, FileId, Ts } from "@slock/types";

export async function postMessage(
  channelId: ChannelId,
  text: string,
  unfurl: string[],
  threadTs?: Ts,
  blocks?: unknown,
  fileIds?: FileId[],
  draft?: PostedDraft,
) {
  const body: Record<string, unknown> = { text, unfurl };
  if (threadTs) body.threadTs = threadTs;
  if (blocks) body.blocks = blocks;
  if (fileIds?.length) body.fileIds = fileIds;
  if (draft) body.draft = draft;
  const data = await apiPost<{ ts: string }>(`/api/channels/${channelId}/messages`, body);
  if (!data.ok) throw replyError(data, "chat.postMessage failed");
  return { ts: parseTs(data.ts) };
}

export async function postBroadcastMessage(
  channelId: ChannelId,
  text: string,
  unfurl: string[],
  threadTs?: Ts,
  blocks?: unknown,
) {
  const body: Record<string, unknown> = { text, unfurl };
  if (threadTs) body.threadTs = threadTs;
  if (blocks) body.blocks = blocks;
  const data = await apiPost<{ ts: string }>(`/api/channels/${channelId}/messages/broadcast`, body);
  if (!data.ok) {
    throw new Error(
      (data.error && BROADCAST_ERROR_MESSAGES[data.error]) ??
        data.error ??
        "chat.postMessage failed",
    );
  }
  return { ts: parseTs(data.ts) };
}

export async function editMessage(
  channelId: ChannelId,
  ts: Ts,
  text: string,
  blocks?: unknown,
  relayed?: boolean,
  fileIds?: FileId[],
) {
  const body: Record<string, unknown> = { text };
  if (blocks) body.blocks = blocks;
  if (fileIds) body.fileIds = fileIds;
  if (relayed) body.relayed = true;
  const data = await apiPatch(`/api/channels/${channelId}/messages/${ts}`, body);
  if (!data.ok) throw replyError(data, "chat.update failed");
  return data;
}

export async function broadcastReply(channelId: ChannelId, ts: Ts, relayed?: boolean) {
  const body: Record<string, unknown> = { replyBroadcast: true };
  if (relayed) body.relayed = true;
  const data = await apiPatch(`/api/channels/${channelId}/messages/${ts}`, body);
  if (!data.ok) throw replyError(data, "chat.update failed");
  return data;
}

export async function deleteMessage(channelId: ChannelId, ts: Ts, relayed?: boolean) {
  const data = await apiDelete(
    `/api/channels/${channelId}/messages/${ts}`,
    relayed ? { relayed: true } : undefined,
  );
  if (!data.ok) throw replyError(data, "chat.delete failed");
  return data;
}

export async function deleteAttachment(channelId: ChannelId, ts: Ts, attachmentId: number) {
  const data = await apiDelete(
    `/api/channels/${channelId}/messages/${ts}/attachments/${attachmentId}`,
  );
  if (!data.ok) throw replyError(data, "chat.deleteAttachment failed");
}

const BROADCAST_ERROR_MESSAGES: Record<string, string> = {
  org_user_not_in_team:
    "The broadcast bot's workspace doesn't include you, so @channel can't be relayed.",
};

export async function toggleThreadSubscription(
  channelId: ChannelId,
  threadTs: Ts,
  remove: boolean,
) {
  const path = `/api/channels/${channelId}/threads/${threadTs}/subscription`;
  const data = remove ? await apiDelete(path) : await apiPost(path);
  if (!data.ok) throw replyError(data, "subscriptions.thread.add/remove failed");
  return data;
}
