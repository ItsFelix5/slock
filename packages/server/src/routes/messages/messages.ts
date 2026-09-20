import type { Credentials } from "../../auth.ts";
import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { isChannelManager } from "../../permissions.ts";
import { botToken, callSlack, callSlackBot } from "../../slackClient.ts";
import { trimMessage } from "../../trim/slackEntities.ts";
import { mutate, type Route, route } from "../router.ts";

function displayName(user: any) {
  return user?.profile?.display_name || user?.profile?.real_name || user?.real_name || user?.name;
}

async function findMyRelayedMessage(
  channelId: string,
  ts: string,
  creds: Credentials | null,
): Promise<any> {
  const me = await callSlack("auth.test", {}, creds);
  if (!me.ok) return;
  const [profile, replies] = await Promise.all([
    callSlack("users.info", { user: me.user_id }, creds),
    callSlack("conversations.replies", { channel: channelId, limit: "1", ts }, creds),
  ]);
  if (!(profile.ok && replies.ok)) return;
  const relayed = replies.messages?.find((m: any) => m.ts === ts);
  const ownedByMe =
    relayed?.bot_id === "B0BU242DJHM" && relayed.username === displayName(profile.user);
  return ownedByMe ? relayed : undefined;
}

export function trimHistory(data: any): any {
  return {
    has_more: data.has_more,
    messages: Array.isArray(data.messages) ? data.messages.map(trimMessage) : data.messages,
    ok: true,
    response_metadata: data.response_metadata
      ? { next_cursor: data.response_metadata.next_cursor }
      : undefined,
  };
}

function trimMessagesListEntry(entry: any): any {
  if (Array.isArray(entry)) return entry.map(trimMessage);
  if (!(entry && typeof entry === "object")) return entry;
  if (entry.ts) return trimMessage(entry);
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
    const data = await callSlack("conversations.history", params, ctx.creds);
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
    const cursor = ctx.searchParams.get("cursor");
    if (cursor) params.cursor = cursor;
    const data = await callSlack("conversations.replies", params, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.replies", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(trimHistory(data), ctx.creds, ctx.acceptEncoding);
  }),

  route("POST", "channels/:id/read", async (ctx) => {
    const { ts } = await (ctx.body.json() as Promise<{ ts?: string }>);
    if (!ts) return errorResponse("invalid_ts", 400);
    return mutate("conversations.mark", { channel: ctx.params.id, ts }, ctx);
  }),

  route("POST", "channels/:id/messages", async (ctx) => {
    const body = await (ctx.body.json() as Promise<{
      text?: string;
      threadTs?: string;
      blocks?: unknown;
      suppressUnfurl?: boolean;
    }>);
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
    const data = await callSlack("chat.postMessage", params, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "chat.postMessage", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse({ ok: true, ts: data.ts }, ctx.creds, ctx.acceptEncoding);
  }),

  route("POST", "channels/:id/messages/broadcast", async (ctx) => {
    if (!botToken()) return errorResponse("bot_not_configured", 503);
    const body = await (ctx.body.json() as Promise<{
      text?: string;
      threadTs?: string;
      blocks?: unknown;
      suppressUnfurl?: boolean;
    }>);
    if (!body.text) return errorResponse("invalid_text", 400);

    const channelId = ctx.params.id;
    const me = await callSlack("auth.test", {}, ctx.creds);
    if (!me.ok) return slackErrorResponse(me, "auth.test", ctx.creds, ctx.acceptEncoding);

    if (!(await isChannelManager(channelId, me.user_id, ctx.creds))) {
      return errorResponse("not_a_channel_manager", 403);
    }

    const profile = await callSlack("users.info", { user: me.user_id }, ctx.creds);
    if (!profile.ok)
      return slackErrorResponse(profile, "users.info", ctx.creds, ctx.acceptEncoding);
    const username = displayName(profile.user);
    const iconUrl = profile.user?.profile?.image_192;

    const params: Record<string, string> = {
      channel: channelId,
      icon_url: iconUrl,
      metadata: JSON.stringify({
        event_payload: { real_user_id: me.user_id },
        event_type: "slock_broadcast_relay",
      }),
      text: body.text,
      username,
    };
    if (body.threadTs) params.thread_ts = body.threadTs;
    if (body.blocks) params.blocks = JSON.stringify(body.blocks);
    if (body.suppressUnfurl) {
      params.unfurl_links = "false";
      params.unfurl_media = "false";
    }

    let posted = await callSlackBot("chat.postMessage", params);
    if (!posted.ok && (posted.error === "not_in_channel" || posted.error === "channel_not_found")) {
      const botIdentity = await callSlackBot("auth.test", {});
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
      posted = await callSlackBot("chat.postMessage", params);
    }
    if (!posted.ok)
      return slackErrorResponse(posted, "bot chat.postMessage", ctx.creds, ctx.acceptEncoding);
    return jsonResponse({ ok: true, ts: posted.ts }, ctx.creds, ctx.acceptEncoding);
  }),

  route("PATCH", "channels/:id/messages/:ts", async (ctx) => {
    const channelId = ctx.params.id;
    const ts = ctx.params.ts;
    const body = await (ctx.body.json() as Promise<{
      text?: string;
      blocks?: unknown;
      replyBroadcast?: boolean;
      relayed?: boolean;
    }>);
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

    const data = await callSlack("chat.update", params, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "chat.update", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse({ ok: true }, ctx.creds, ctx.acceptEncoding);
  }),

  route("DELETE", "channels/:id/messages/:ts", async (ctx) => {
    const channelId = ctx.params.id;
    const ts = ctx.params.ts;
    const { relayed } = await (ctx.body.json() as Promise<{ relayed?: boolean }>);

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
    const { messageIds } = await (ctx.body.json() as Promise<{
      messageIds?: { channel: string; timestamps: string[] }[];
    }>);
    if (!messageIds?.length) return errorResponse("invalid_message_ids", 400);
    const data = await callSlack(
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
