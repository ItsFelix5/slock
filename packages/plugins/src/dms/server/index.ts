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
    const { userId, userIds } = await ctx.body.json<{ userId?: string; userIds?: string[] }>();
    const users = userIds ?? (userId ? [userId] : []);
    if (!users.length) return errorResponse("invalid_user_id", 400);
    const data = await callSlack<ChannelReply>(
      "conversations.open",
      { users: users.join(",") },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.open");
    }
    return jsonResponse({ channel: { id: data.channel.id }, ok: true });
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
