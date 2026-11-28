import type { Setup } from "@slock/core";
import { service } from "@slock/core/services";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { mutate, route, routes } from "@slock/plugins/slack/server/api/router";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";

function pausedUntil(info: DndReply, now: number): number | null {
  if (info.snooze_enabled && info.snooze_endtime && info.snooze_endtime > now)
    return info.snooze_endtime * 1000;
  const { next_dnd_start_ts: start, next_dnd_end_ts: end } = info;
  if (info.dnd_enabled && start && end && start <= now && now < end) return end * 1000;
  return null;
}

const env = service("env");

const list: Route[] = [
  route("GET", "dnd/snooze", async (ctx) => {
    const data = await callSlack<DndReply>("dnd.info", {}, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "dnd.info");
    const endtime = data.snooze_enabled ? data.snooze_endtime : undefined;
    return jsonResponse({ endtime: endtime ?? null });
  }),

  route("GET", "dnd/users/:id", async (ctx) => {
    const data = await callSlack<DndReply>("dnd.info", { user: ctx.params.id }, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "dnd.info");
    return jsonResponse({ pausedUntil: pausedUntil(data, env.now() / 1000) });
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

type DndReply = {
  dnd_enabled?: boolean;
  next_dnd_end_ts?: number;
  next_dnd_start_ts?: number;
  snooze_enabled?: boolean;
  snooze_endtime?: number;
};
