import type { Setup } from "@slock/core";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { mutate, route, routes } from "@slock/plugins/slack/server/api/router";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import type { ChannelReply } from "@slock/plugins/slack/server/api/slackReplies";
import { trimChannel } from "@slock/plugins/slack/server/api/trim/slackChannels";

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

  route("POST", "dms/:channel/members", async (ctx) => {
    const { userIds, historyStartTs } = await ctx.body.json<{
      userIds?: string[];
      historyStartTs?: string;
    }>();
    if (!userIds?.length) return errorResponse("invalid_user_ids", 400);
    const data = await callSlack<ChannelReply>(
      "conversations.createChild",
      {
        channel: ctx.params.channel,
        user_ids: userIds.join(","),
        ...(historyStartTs && { migrate_history_start_ts: historyStartTs }),
      },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.createChild");
    }
    return jsonResponse({ channel: trimChannel(data.channel), ok: true });
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
