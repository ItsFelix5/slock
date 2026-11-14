import type { Setup } from "@slock/core";
import { isRecord } from "@slock/core";
import { isRawMessage } from "@slock/slack";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import { relayDelete, relayEdit } from "../../slack/server/api/relayMessages";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type {
  ConversationViewReply,
  HistoryReply,
  MessagesListReply,
  PostMessageReply,
  UnfurlLinkReply,
} from "../../slack/server/api/slackReplies";
import { trimChannel } from "../../slack/server/api/trim/slackChannels";
import { trimUser } from "../../slack/server/api/trim/slackEntities";
import { trimAttachment, trimMessage } from "../../slack/server/api/trim/slackMessages";
import { historyParams, trimHistory } from "./api";

function trimMessagesListEntry(entry: unknown): unknown {
  if (Array.isArray(entry)) return entry.map(trimMessagesListEntry);
  if (!isRecord(entry)) return entry;
  if (isRawMessage(entry)) return trimMessage(entry);
  if (entry.messages !== undefined) return { messages: trimMessagesListEntry(entry.messages) };
  return Object.fromEntries(
    Object.entries(entry).map(([key, value]) => [key, trimMessagesListEntry(value)]),
  );
}

const list: Route[] = [
  route("GET", "channels/:id/messages", async (ctx) => {
    const params = historyParams({ channel: ctx.params.id, limit: "60" }, ctx.searchParams);
    const data = await callSlack<HistoryReply>("conversations.history", params, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.history", ctx.creds);
    }
    return jsonResponse(trimHistory(data), ctx.creds);
  }),

  route("POST", "channels/:id/messages", async (ctx) => {
    const body = await ctx.body.json<{
      text?: string;
      threadTs?: string;
      blocks?: unknown;
      unfurl?: string[];
      fileIds?: string[];
    }>();
    if (!body.text) return errorResponse("invalid_text", 400);
    const params: Record<string, string> = {
      channel: ctx.params.id,
      text: body.text,
    };
    if (body.threadTs) params.thread_ts = body.threadTs;
    if (body.blocks) params.blocks = JSON.stringify(body.blocks);
    if (body.unfurl) params.unfurl = JSON.stringify(body.unfurl.map((url) => ({ url })));
    const data = await callSlack<PostMessageReply>(
      "chat.postMessage",
      body.fileIds?.length ? { ...params, file_ids: body.fileIds } : params,
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "chat.postMessage", ctx.creds);
    }
    return jsonResponse({ ok: true, ts: data.ts }, ctx.creds);
  }),

  route("POST", "channels/:id/unfurl", async (ctx) => {
    const { url } = await ctx.body.json<{ url?: string }>();
    if (!url) return errorResponse("invalid_url", 400);
    const data = await callSlack<UnfurlLinkReply>(
      "chat.unfurlLink",
      { channel: ctx.params.id, url },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "chat.unfurlLink", ctx.creds);
    const attachment = data.attachments?.[url];
    return jsonResponse(
      { attachment: attachment && trimAttachment(attachment), ok: true },
      ctx.creds,
    );
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
      return relayEdit(ctx, channelId, ts, { blocks: body.blocks, text: body.text });
    }

    const data = await callSlack(
      "chat.update",
      body.fileIds ? { ...params, file_ids: body.fileIds.length ? body.fileIds : "" } : params,
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "chat.update", ctx.creds);
    }
    return jsonResponse({ ok: true }, ctx.creds);
  }),

  route("DELETE", "channels/:id/messages/:ts", async (ctx) => {
    const { id: channelId, ts } = ctx.params;
    const { relayed } = await ctx.body
      .json<{ relayed?: boolean }>()
      .catch((): { relayed?: boolean } => ({}));

    if (relayed) return relayDelete(ctx, channelId, ts);

    return mutate("chat.delete", { channel: channelId, ts }, ctx);
  }),

  route("DELETE", "channels/:id/messages/:ts/attachments/:attachment", (ctx) => {
    const { id: channel, ts, attachment } = ctx.params;
    return mutate("chat.deleteAttachment", { attachment, channel, ts }, ctx);
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
      return slackErrorResponse(data, "messages.list", ctx.creds);
    }
    return jsonResponse({ messages: trimMessagesListEntry(data.messages), ok: true }, ctx.creds);
  }),

  route("GET", "channels/:id/view", async (ctx) => {
    const data = await callSlack<ConversationViewReply>(
      "conversations.view",
      {
        canonical_avatars: "true",
        channel: ctx.params.id,
        count: "30",
        ignore_replies: "true",
        include_full_users: "true",
        include_mutation_timestamps: "true",
        include_stories: "true",
        include_use_case: "true",
        no_members: "true",
        no_self: "true",
        no_user_profile: "true",
      },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "conversations.view", ctx.creds);
    return jsonResponse(
      {
        channel: data.channel && trimChannel(data.channel),
        ok: true,
        users: data.users?.map(trimUser),
      },
      ctx.creds,
    );
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
