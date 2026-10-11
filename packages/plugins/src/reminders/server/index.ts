import type { Setup } from "@slock/core";
import { errorResponse } from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";

const list: Route[] = [
  route("POST", "reminders", async (ctx) => {
    const requestBody = await ctx.body.json<{
      text?: string;
      time?: string;
      channelId?: string;
      ts?: string;
      dateDue?: number;
    }>();

    if (requestBody.channelId && requestBody.ts && requestBody.dateDue !== undefined) {
      return mutate(
        "reminders.add",
        {
          date_due: String(requestBody.dateDue),
          item_id: requestBody.channelId,
          item_type: "message",
          ts: requestBody.ts,
        },
        ctx,
      );
    }
    if (requestBody.text && requestBody.time) {
      return mutate("reminders.add", { text: requestBody.text, time: requestBody.time }, ctx);
    }
    return errorResponse("invalid_reminder", 400);
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
