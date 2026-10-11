import type { Setup } from "@slock/core";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { DndReply } from "../../slack/server/api/slackReplies";

const list: Route[] = [
  route("GET", "dnd/snooze", async (ctx) => {
    const data = await callSlack<DndReply>("dnd.info", {}, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "dnd.info", ctx.creds);
    const endtime = data.snooze_enabled ? data.snooze_endtime : undefined;
    return jsonResponse({ endtime: endtime ?? null }, ctx.creds);
  }),

  route("PUT", "dnd/snooze", async (ctx) => {
    const { minutes } = await ctx.body.json<{ minutes?: number }>();
    if (!minutes) return errorResponse("invalid_minutes", 400);
    return mutate("dnd.setSnooze", { num_minutes: String(minutes) }, ctx);
  }),

  route("DELETE", "dnd/snooze", (ctx) => mutate("dnd.endSnooze", {}, ctx)),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
