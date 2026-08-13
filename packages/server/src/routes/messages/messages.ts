import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import { trimMessage } from "../../trim/slackEntities.ts";
import { type Route, route } from "../router.ts";

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
  route("GET", "/api/channels/:id/messages", async (ctx) => {
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

  route("GET", "/api/channels/:id/threads/:ts/messages", async (ctx) => {
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

  route("POST", "/api/channels/:id/read", async (ctx) => {
    const { ts } = (await ctx.body.json()) as { ts?: string };
    if (!ts) return errorResponse("invalid_ts", 400);
    const data = await callSlack("conversations.mark", { channel: ctx.params.id, ts }, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.mark", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse({ ok: true }, ctx.creds, ctx.acceptEncoding);
  }),

  route("POST", "/api/channels/:id/messages", async (ctx) => {
    const body = (await ctx.body.json()) as {
      text?: string;
      threadTs?: string;
      blocks?: unknown;
      suppressUnfurl?: boolean;
    };
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

  route("PATCH", "/api/channels/:id/messages/:ts", async (ctx) => {
    const body = (await ctx.body.json()) as {
      text?: string;
      blocks?: unknown;
      replyBroadcast?: boolean;
    };
    const params: Record<string, string> = {
      channel: ctx.params.id,
      ts: ctx.params.ts,
    };
    if (body.replyBroadcast) {
      params.reply_broadcast = "true";
    } else {
      if (!body.text) return errorResponse("invalid_text", 400);
      params.text = body.text;
      if (body.blocks) params.blocks = JSON.stringify(body.blocks);
    }
    const data = await callSlack("chat.update", params, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "chat.update", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse({ ok: true }, ctx.creds, ctx.acceptEncoding);
  }),

  route("DELETE", "/api/channels/:id/messages/:ts", async (ctx) => {
    const data = await callSlack(
      "chat.delete",
      { channel: ctx.params.id, ts: ctx.params.ts },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "chat.delete", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse({ ok: true }, ctx.creds, ctx.acceptEncoding);
  }),

  route("POST", "/api/messages/lookup", async (ctx) => {
    const { messageIds } = (await ctx.body.json()) as {
      messageIds?: { channel: string; timestamps: string[] }[];
    };
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
