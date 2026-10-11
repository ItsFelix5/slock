import type { Setup } from "@slock/core";
import { jsonResponse, slackErrorResponse } from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { PinsListReply } from "../../slack/server/api/slackReplies";
import { trimMessage } from "../../slack/server/api/trim/slackMessages";

const list: Route[] = [
  route("POST", "messages/:channel/:ts/pin", (ctx) =>
    mutate("pins.add", { channel: ctx.params.channel, timestamp: ctx.params.ts }, ctx),
  ),

  route("DELETE", "messages/:channel/:ts/pin", (ctx) =>
    mutate("pins.remove", { channel: ctx.params.channel, timestamp: ctx.params.ts }, ctx),
  ),

  route("GET", "channels/:id/pins", async (ctx) => {
    const data = await callSlack<PinsListReply>("pins.list", { channel: ctx.params.id }, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "pins.list", ctx.creds);
    return jsonResponse(
      {
        items: (data.items ?? []).map((item) => ({
          message: item.type === "message" && item.message ? trimMessage(item.message) : undefined,
          ts: item.message?.ts ?? item.created ?? item.channel,
        })),
        ok: true,
      },
      ctx.creds,
    );
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
