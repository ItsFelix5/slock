import type { Setup } from "@slock/core";
import { slackPart } from "../../bootstrap/server/api";
import { errorResponse } from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import type { CountsReply } from "../../slack/server/api/slackReplies";
import {
  trimActivityCounts,
  trimCountGroup,
  trimCountGroups,
} from "../../slack/server/api/trim/slackChannels";

const list: Route[] = [
  route("POST", "channels/:id/read", async (ctx) => {
    const { ts } = await ctx.body.json<{ ts?: string }>();
    if (!ts) return errorResponse("invalid_ts", 400);
    return mutate("conversations.mark", { channel: ctx.params.id, ts }, ctx);
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
  ctx.add(
    "bootstrap.part",
    slackPart<CountsReply>(
      "counts",
      "client.counts",
      (data) => ({
        notifications: trimActivityCounts(data.activity_v2),
        unreads: trimCountGroups(data, trimCountGroup),
      }),
      { optional: true },
    ),
  );
};

export default setup;
