import type { Setup } from "@slock/core";
import { historyParams, trimHistory } from "../../messages/server/api";
import { isChannelManager } from "../../slack/server/api/channelManagers";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { botToken, callSlack, callSlackBot } from "../../slack/server/api/slackClient";
import type {
  AuthTestReply,
  HistoryReply,
  PostMessageReply,
  UserReply,
} from "../../slack/server/api/slackReplies";
import { displayName } from "../../slack/server/api/trim/slackEntities";

const list: Route[] = [
  route("GET", "channels/:id/threads/:ts/messages", async (ctx) => {
    const params = historyParams(
      { channel: ctx.params.id, limit: "200", ts: ctx.params.ts },
      ctx.searchParams,
    );
    const data = await callSlack<HistoryReply>("conversations.replies", params, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.replies", ctx.creds);
    }
    return jsonResponse(trimHistory(data), ctx.creds);
  }),

  route("POST", "channels/:id/messages/broadcast", async (ctx) => {
    if (!botToken()) return errorResponse("bot_not_configured", 503);
    const body = await ctx.body.json<{
      text?: string;
      threadTs?: string;
      blocks?: unknown;
      unfurl?: string[];
    }>();
    if (!body.text) return errorResponse("invalid_text", 400);

    const channelId = ctx.params.id;
    const me = await callSlack<AuthTestReply>("auth.test", {}, ctx.creds);
    if (!me.ok) return slackErrorResponse(me, "auth.test", ctx.creds);

    if (!(await isChannelManager(channelId, me.user_id, ctx.creds))) {
      return errorResponse("not_a_channel_manager", 403);
    }

    const profile = await callSlack<UserReply>("users.info", { user: me.user_id }, ctx.creds);
    if (!profile.ok) return slackErrorResponse(profile, "users.info", ctx.creds);
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
    if (body.unfurl && !body.unfurl.length) {
      params.unfurl_links = "false";
      params.unfurl_media = "false";
    }

    let posted = await callSlackBot<PostMessageReply>("chat.postMessage", params);
    if (!posted.ok && (posted.error === "not_in_channel" || posted.error === "channel_not_found")) {
      const botIdentity = await callSlackBot<AuthTestReply>("auth.test", {});
      if (!botIdentity.ok) {
        return slackErrorResponse(botIdentity, "bot auth.test", ctx.creds);
      }
      const invite = await callSlack(
        "conversations.invite",
        { channel: channelId, users: botIdentity.user_id },
        ctx.creds,
      );
      if (!invite.ok) {
        return slackErrorResponse(invite, "conversations.invite", ctx.creds);
      }
      posted = await callSlackBot<PostMessageReply>("chat.postMessage", params);
    }
    if (!posted.ok) return slackErrorResponse(posted, "bot chat.postMessage", ctx.creds);
    return jsonResponse({ ok: true, ts: posted.ts }, ctx.creds);
  }),

  route("POST", "channels/:id/threads/:ts/subscription", (ctx) =>
    mutate("subscriptions.thread.add", { channel: ctx.params.id, thread_ts: ctx.params.ts }, ctx),
  ),

  route("DELETE", "channels/:id/threads/:ts/subscription", (ctx) =>
    mutate(
      "subscriptions.thread.remove",
      { channel: ctx.params.id, thread_ts: ctx.params.ts },
      ctx,
    ),
  ),

  route("POST", "channels/:id/threads/:ts/read", async (ctx) => {
    const { ts } = await ctx.body.json<{ ts?: string }>();
    if (!ts) return errorResponse("invalid_ts", 400);
    return mutate(
      "subscriptions.thread.mark",
      { channel: ctx.params.id, thread_ts: ctx.params.ts, ts },
      ctx,
    );
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
