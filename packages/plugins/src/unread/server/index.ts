import type { Setup } from "@slock/core";
import { slackPart } from "../../bootstrap/server/api";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { CountsReply } from "../../slack/server/api/slackReplies";
import {
  trimActivityCounts,
  trimCountGroup,
  trimCountGroups,
} from "../../slack/server/api/trim/slackChannels";

function trimCounts(data: CountsReply) {
  return {
    notifications: trimActivityCounts(data.activity_v2),
    unreads: trimCountGroups(data, trimCountGroup),
  };
}

const list: Route[] = [
  route("POST", "channels/:id/read", async (ctx) => {
    const { ts } = await ctx.body.json<{ ts?: string }>();
    if (!ts) return errorResponse("invalid_ts", 400);
    return mutate("conversations.mark", { channel: ctx.params.id, ts }, ctx);
  }),
  route("GET", "counts", async (ctx) => {
    const data = await callSlack<CountsReply>("client.counts", {}, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "client.counts", ctx.creds);
    return jsonResponse({ ...trimCounts(data), ok: true }, ctx.creds);
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
  ctx.add(
    "bootstrap.part",
    slackPart<CountsReply>("counts", "client.counts", trimCounts, { optional: true }),
  );
};

export default setup;
