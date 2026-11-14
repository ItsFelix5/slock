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

function pausedUntil(info: DndReply, now: number): number | null {
  if (info.snooze_enabled && info.snooze_endtime && info.snooze_endtime > now)
    return info.snooze_endtime * 1000;
  const { next_dnd_start_ts: start, next_dnd_end_ts: end } = info;
  if (info.dnd_enabled && start && end && start <= now && now < end) return end * 1000;
  return null;
}

const list: Route[] = [
  route("GET", "dnd/snooze", async (ctx) => {
    const data = await callSlack<DndReply>("dnd.info", {}, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "dnd.info", ctx.creds);
    const endtime = data.snooze_enabled ? data.snooze_endtime : undefined;
    return jsonResponse({ endtime: endtime ?? null }, ctx.creds);
  }),

  route("GET", "dnd/users/:id", async (ctx) => {
    const data = await callSlack<DndReply>("dnd.info", { user: ctx.params.id }, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "dnd.info", ctx.creds);
    return jsonResponse({ pausedUntil: pausedUntil(data, Date.now() / 1000) }, ctx.creds);
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
