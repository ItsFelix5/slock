import type { Setup } from "@slock/core";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { ChannelReply } from "../../slack/server/api/slackReplies";

const list: Route[] = [
  route("POST", "channels/:id/close", (ctx) =>
    mutate("conversations.close", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "dms", async (ctx) => {
    const { userId } = await ctx.body.json<{ userId?: string }>();
    if (!userId) return errorResponse("invalid_user_id", 400);
    const data = await callSlack<ChannelReply>("conversations.open", { users: userId }, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.open", ctx.creds);
    }
    return jsonResponse({ channel: { id: data.channel.id }, ok: true }, ctx.creds);
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
