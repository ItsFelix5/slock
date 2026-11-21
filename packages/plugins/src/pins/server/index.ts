import type { Setup } from "@slock/core";
import { jsonResponse, slackErrorResponse } from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { mutate, route, routes } from "@slock/plugins/slack/server/api/router";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import type { PinsListReply } from "@slock/plugins/slack/server/api/slackReplies";
import { trimMessage } from "@slock/plugins/slack/server/api/trim/slackMessages";

const list: Route[] = [
  route("POST", "messages/:channel/:ts/pin", (ctx) =>
    mutate("pins.add", { channel: ctx.params.channel, timestamp: ctx.params.ts }, ctx),
  ),

  route("DELETE", "messages/:channel/:ts/pin", (ctx) =>
    mutate("pins.remove", { channel: ctx.params.channel, timestamp: ctx.params.ts }, ctx),
  ),

  route("GET", "channels/:id/pins", async (ctx) => {
    const data = await callSlack<PinsListReply>("pins.list", { channel: ctx.params.id }, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "pins.list");
    return jsonResponse({
      items: (data.items ?? []).map((item) => ({
        message: item.type === "message" && item.message ? trimMessage(item.message) : undefined,
        ts: item.message?.ts ?? item.created ?? item.channel,
      })),
      ok: true,
    });
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
