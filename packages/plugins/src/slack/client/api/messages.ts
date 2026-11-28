import { replyError } from "@slock/slack";
import {
  apiDelete,
  apiGet,
  apiPost,
  getWorkspaceDomain,
  mapVisibleMessage,
} from "@slock/slack/client";
import type { ChannelId, Message, RawMessage, Ts } from "@slock/types";

import { fetchRepliesFrom } from "./threadReplies";

export { fetchHistoryAround } from "./messageHistory";

type HistoryReply = {
  has_more?: boolean;
  messages?: RawMessage[];
  response_metadata?: { next_cursor?: string };
};

export async function fetchPermalinkMessage(
  channelId: ChannelId,
  messageTs: Ts,
  threadTs: Ts,
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
  if (!data.ok) throw replyError(data, "conversations.history failed");
  const raw = data.messages?.find((m) => m.ts === messageTs);
  return raw && mapVisibleMessage(raw);
}

export type PostedDraft = { clientMsgId: string; id: string };

const SETTLED_REACTION_ERRORS = new Set(["already_reacted", "no_reaction"]);

export const isReactionSettled = (error: unknown) =>
  error instanceof Error && SETTLED_REACTION_ERRORS.has(error.message);

export async function toggleReaction(channelId: ChannelId, ts: Ts, name: string, remove: boolean) {
  const path = `/api/messages/${channelId}/${ts}/reactions`;
  const data = remove ? await apiDelete(path, { name }) : await apiPost(path, { name });
  if (!data.ok) throw replyError(data, "reactions failed");
  return data;
}

export async function getChannelLink(channelId: ChannelId): Promise<string | null> {
  try {
    return `https://${await getWorkspaceDomain()}/archives/${channelId}`;
  } catch (err) {
    console.error("Failed to resolve workspace domain for link", err);
    return null;
  }
}
