import type { Setup } from "@slock/core";
import { logUnknown } from "@slock/core";
import { jsonResponse, slackErrorResponse } from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { mutate, route, routes } from "@slock/plugins/slack/server/api/router";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import type { SavedListReply } from "@slock/plugins/slack/server/api/slackReplies";

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

  route("POST", "messages/:channel/:ts/reminder", async (ctx) => {
    const { dateDue } = await ctx.body.json<{ dateDue: number }>();
    return mutate(
      "saved.add",
      {
        date_due: String(dateDue),
        item_id: ctx.params.channel,
        item_type: "message",
        ts: ctx.params.ts,
      },
      ctx,
    );
  }),

  route("PATCH", "messages/:channel/:ts/save", async (ctx) => {
    const { dateDue } = await ctx.body.json<{ dateDue: number }>();
    return mutate(
      "saved.update",
      {
        item_id: ctx.params.channel,
        item_type: "message",
        ts: ctx.params.ts,
        date_due: String(dateDue),
      },
      ctx,
    );
  }),

  route("GET", "saved", async (ctx) => {
    const data = await callSlack<SavedListReply>("saved.list", { limit: "40" }, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "saved.list");

    const items = data.saved_items ?? data.items ?? [];
    const normalized = items
      .filter((item) => {
        const isMessage = !item.item_type || item.item_type === "message";
        if (!isMessage) logUnknown("saved item", item.item_type);
        return isMessage;
      })
      .filter((item) => !item.state || item.state === "in_progress")
      .map((item) => ({
        channelId: item.item_id ?? item.channel_id ?? item.channel,
        dateCreated: item.date_created,
        dateDue: item.date_due || undefined,
        ts: item.ts ?? item.message_ts,
      }))
      .filter((item) => !!item.channelId && !!item.ts);
    return jsonResponse({ items: normalized, ok: true });
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
