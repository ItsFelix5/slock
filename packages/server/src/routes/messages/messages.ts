import { isRawMessage, isRecord, type RawMessage, type RawUser } from "@slock/types";
import type { Credentials } from "../../auth.ts";
import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { isChannelManager } from "../../permissions.ts";
import { botToken, callSlack, callSlackBot } from "../../slackClient.ts";
import type {
  AuthTestReply,
  HistoryReply,
  MessagesListReply,
  PostMessageReply,
  UserReply,
} from "../../slackReplies.ts";
import { trimMessage } from "../../trim/slackMessages.ts";
import { mutate, type Route, route } from "../router.ts";

function displayName(user: RawUser) {
  return user?.profile?.display_name || user?.profile?.real_name || user?.real_name || user?.name;
}

async function findMyRelayedMessage(
  channelId: string,
  ts: string,
  creds: Credentials | null,
): Promise<RawMessage | undefined> {
  const me = await callSlack<AuthTestReply>("auth.test", {}, creds);
  if (!me.ok) return;
  const [profile, replies] = await Promise.all([
    callSlack<UserReply>("users.info", { user: me.user_id }, creds),
    callSlack<HistoryReply>("conversations.replies", { channel: channelId, limit: "1", ts }, creds),
  ]);
  if (!(profile.ok && replies.ok)) return;
  const relayed = replies.messages?.find((m) => m.ts === ts);
  const ownedByMe =
    relayed?.bot_id === "B0BU242DJHM" && relayed.username === displayName(profile.user);
  return ownedByMe ? relayed : undefined;
}

export function trimHistory(data: HistoryReply) {
  return {
    has_more: data.has_more,
    messages: data.messages?.map(trimMessage),
    ok: true,
    response_metadata: data.response_metadata
      ? { next_cursor: data.response_metadata.next_cursor }
      : undefined,
  };
}

function trimMessagesListEntry(entry: unknown): unknown {
  if (Array.isArray(entry)) return entry.map(trimMessagesListEntry);
  if (!isRecord(entry)) return entry;
  if (isRawMessage(entry)) return trimMessage(entry);
  if (entry.messages !== undefined) return { messages: trimMessagesListEntry(entry.messages) };
  return Object.fromEntries(
    Object.entries(entry).map(([key, value]) => [key, trimMessagesListEntry(value)]),
  );
}

const HISTORY_PARAM_KEYS = ["cursor", "latest", "oldest", "inclusive", "limit"] as const;

export const messageRoutes: Route[] = [
  route("GET", "channels/:id/messages", async (ctx) => {
    const params: Record<string, string> = {
      channel: ctx.params.id,
      limit: "60",
    };
    for (const key of HISTORY_PARAM_KEYS) {
      const value = ctx.searchParams.get(key);
      if (value) params[key] = value;
    }
    const data = await callSlack<HistoryReply>("conversations.history", params, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.history", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(trimHistory(data), ctx.creds, ctx.acceptEncoding);
  }),

  route("GET", "channels/:id/threads/:ts/messages", async (ctx) => {
    const params: Record<string, string> = {
      channel: ctx.params.id,
      limit: "200",
      ts: ctx.params.ts,
    };
    for (const key of HISTORY_PARAM_KEYS) {
      const value = ctx.searchParams.get(key);
      if (value) params[key] = value;
    }
    const data = await callSlack<HistoryReply>("conversations.replies", params, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.replies", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(trimHistory(data), ctx.creds, ctx.acceptEncoding);
  }),

  route("POST", "channels/:id/read", async (ctx) => {
    const { ts } = await ctx.body.json<{ ts?: string }>();
    if (!ts) return errorResponse("invalid_ts", 400);
    return mutate("conversations.mark", { channel: ctx.params.id, ts }, ctx);
  }),

  route("POST", "channels/:id/messages", async (ctx) => {
    const body = await ctx.body.json<{
      text?: string;
      threadTs?: string;
      blocks?: unknown;
      suppressUnfurl?: boolean;
      fileIds?: string[];
    }>();
    if (!body.text) return errorResponse("invalid_text", 400);
    const params: Record<string, string> = {
      channel: ctx.params.id,
      text: body.text,
    };
    if (body.threadTs) params.thread_ts = body.threadTs;
    if (body.blocks) params.blocks = JSON.stringify(body.blocks);

    if (body.suppressUnfurl) {
      params.unfurl_links = "false";
      params.unfurl_media = "false";
    }
    const data = await callSlack<PostMessageReply>(
      "chat.postMessage",
      body.fileIds?.length ? { ...params, file_ids: body.fileIds } : params,
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "chat.postMessage", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse({ ok: true, ts: data.ts }, ctx.creds, ctx.acceptEncoding);
  }),

  route("POST", "channels/:id/messages/broadcast", async (ctx) => {
    if (!botToken()) return errorResponse("bot_not_configured", 503);
    const body = await ctx.body.json<{
      text?: string;
      threadTs?: string;
      blocks?: unknown;
      suppressUnfurl?: boolean;
    }>();
    if (!body.text) return errorResponse("invalid_text", 400);

    const channelId = ctx.params.id;
    const me = await callSlack<AuthTestReply>("auth.test", {}, ctx.creds);
    if (!me.ok) return slackErrorResponse(me, "auth.test", ctx.creds, ctx.acceptEncoding);

    if (!(await isChannelManager(channelId, me.user_id, ctx.creds))) {
      return errorResponse("not_a_channel_manager", 403);
    }

    const profile = await callSlack<UserReply>("users.info", { user: me.user_id }, ctx.creds);
    if (!profile.ok)
      return slackErrorResponse(profile, "users.info", ctx.creds, ctx.acceptEncoding);
    const params: Record<string, string> = {
      channel: channelId,
      text: body.text,
    };
    const username = displayName(profile.user);
    if (username) params.username = username;
    const iconUrl = profile.user.profile?.image_192;
    if (iconUrl) params.icon_url = iconUrl;
    if (body.threadTs) params.thread_ts = body.threadTs;
    if (body.blocks) params.blocks = JSON.stringify(body.blocks);
    if (body.suppressUnfurl) {
      params.unfurl_links = "false";
      params.unfurl_media = "false";
    }

    let posted = await callSlackBot<PostMessageReply>("chat.postMessage", params);
    if (!posted.ok && (posted.error === "not_in_channel" || posted.error === "channel_not_found")) {
      const botIdentity = await callSlackBot<AuthTestReply>("auth.test", {});
      if (!botIdentity.ok) {
        return slackErrorResponse(botIdentity, "bot auth.test", ctx.creds, ctx.acceptEncoding);
      }
      const invite = await callSlack(
        "conversations.invite",
        { channel: channelId, users: botIdentity.user_id },
        ctx.creds,
      );
      if (!invite.ok) {
        return slackErrorResponse(invite, "conversations.invite", ctx.creds, ctx.acceptEncoding);
      }
      posted = await callSlackBot<PostMessageReply>("chat.postMessage", params);
    }
    if (!posted.ok)
      return slackErrorResponse(posted, "bot chat.postMessage", ctx.creds, ctx.acceptEncoding);
    return jsonResponse({ ok: true, ts: posted.ts }, ctx.creds, ctx.acceptEncoding);
  }),

  route("PATCH", "channels/:id/messages/:ts", async (ctx) => {
    const { id: channelId, ts } = ctx.params;
    const body = await ctx.body.json<{
      text?: string;
      blocks?: unknown;
      fileIds?: string[];
      replyBroadcast?: boolean;
      relayed?: boolean;
    }>();
    const params: Record<string, string> = { channel: channelId, ts };
    if (body.replyBroadcast) {
      params.reply_broadcast = "true";
    } else {
      if (!body.text) return errorResponse("invalid_text", 400);
      params.text = body.text;
      if (body.blocks) params.blocks = JSON.stringify(body.blocks);
    }

    if (body.relayed) {
      if (!botToken()) return errorResponse("bot_not_configured", 503);
      if (!(await findMyRelayedMessage(channelId, ts, ctx.creds))) {
        return errorResponse("cant_update_message", 403);
      }
      const botUpdated = await callSlackBot("chat.update", params);
      if (!botUpdated.ok) {
        return slackErrorResponse(botUpdated, "bot chat.update", ctx.creds, ctx.acceptEncoding);
      }
      return jsonResponse({ ok: true }, ctx.creds, ctx.acceptEncoding);
    }

    const data = await callSlack(
      "chat.update",
      body.fileIds ? { ...params, file_ids: body.fileIds.length ? body.fileIds : "" } : params,
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "chat.update", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse({ ok: true }, ctx.creds, ctx.acceptEncoding);
  }),

  route("DELETE", "channels/:id/messages/:ts", async (ctx) => {
    const { id: channelId, ts } = ctx.params;
    const { relayed } = await ctx.body
      .json<{ relayed?: boolean }>()
      .catch((): { relayed?: boolean } => ({}));

    if (relayed) {
      if (!botToken()) return errorResponse("bot_not_configured", 503);
      if (!(await findMyRelayedMessage(channelId, ts, ctx.creds))) {
        return errorResponse("cant_delete_message", 403);
      }
      const botDeleted = await callSlackBot("chat.delete", { channel: channelId, ts });
      if (!botDeleted.ok) {
        return slackErrorResponse(botDeleted, "bot chat.delete", ctx.creds, ctx.acceptEncoding);
      }
      return jsonResponse({ ok: true }, ctx.creds, ctx.acceptEncoding);
    }

    return mutate("chat.delete", { channel: channelId, ts }, ctx);
  }),

  route("POST", "messages/lookup", async (ctx) => {
    const { messageIds } = await ctx.body.json<{
      messageIds?: { channel: string; timestamps: string[] }[];
    }>();
    if (!messageIds?.length) return errorResponse("invalid_message_ids", 400);
    const data = await callSlack<MessagesListReply>(
      "messages.list",
      { message_ids: JSON.stringify(messageIds) },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "messages.list", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(
      { messages: trimMessagesListEntry(data.messages), ok: true },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
];
