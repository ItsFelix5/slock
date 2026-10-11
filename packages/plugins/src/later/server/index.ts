import type { Setup } from "@slock/core";
import { jsonResponse, slackErrorResponse } from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { SavedListReply } from "../../slack/server/api/slackReplies";

const list: Route[] = [
  route("POST", "messages/:channel/:ts/save", (ctx) =>
    mutate(
      "saved.add",
      { item_id: ctx.params.channel, item_type: "message", ts: ctx.params.ts },
      ctx,
    ),
  ),

  route("DELETE", "messages/:channel/:ts/save", (ctx) =>
    mutate(
      "saved.delete",
      { item_id: ctx.params.channel, item_type: "message", ts: ctx.params.ts },
      ctx,
    ),
  ),

  route("GET", "saved", async (ctx) => {
    const data = await callSlack<SavedListReply>("saved.list", { limit: "40" }, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "saved.list", ctx.creds);

    const items = data.saved_items ?? data.items ?? [];
    const normalized = items
      .filter((item) => !item.item_type || item.item_type === "message")
      .map((item) => ({
        channelId: item.item_id ?? item.channel_id ?? item.channel,
        ts: item.ts ?? item.message_ts,
      }))
      .filter((item) => !!item.channelId && !!item.ts);
    return jsonResponse({ items: normalized, ok: true }, ctx.creds);
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
