import type { Setup } from "@slock/core";
import { errorResponse } from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, prefWrite, route, routes } from "../../slack/server/api/router";

const list: Route[] = [
  route("PUT", "channels/:id/notifications", async (ctx) => {
    const { target, value } = await ctx.body.json<{
      target?: "desktop" | "mobile";
      value?: string;
    }>();
    if (!(target && value)) return errorResponse("invalid_notification_target", 400);
    return mutate(
      "users.prefs.setNotifications",
      { channel_id: ctx.params.id, global: "false", name: target, value },
      ctx,
    );
  }),

  route("PUT", "preferences/muted-channels", async (ctx) => {
    const { channelIds } = await ctx.body.json<{ channelIds?: string[] }>();
    if (!channelIds) return errorResponse("invalid_channel_ids", 400);
    return prefWrite("muted_channels", channelIds.join(","), ctx);
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
