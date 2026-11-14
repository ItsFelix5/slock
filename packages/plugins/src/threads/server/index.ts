import type { Setup } from "@slock/core";
import { historyParams, trimHistory } from "../../messages/server/api";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import { relayBroadcast } from "../../slack/server/api/relayMessages";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { HistoryReply } from "../../slack/server/api/slackReplies";

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

  route("POST", "channels/:id/messages/broadcast", async (ctx) =>
    relayBroadcast(ctx, ctx.params.id, await ctx.body.json()),
  ),

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
