// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { errorResponse, jsonResponse, okResponse } from "../http/jsonResponse.ts";
import { fetchSlack } from "../slackClient.ts";
import { trimMessage } from "../trim/slackEntities.ts";
import { type Route, type RouteCtx, route } from "./router.ts";

async function mutate(
  slackMethod: string,
  params: Record<string, string>,
  ctx: RouteCtx,
): Promise<Response> {
  const data = await fetchSlack(slackMethod, params, ctx.creds);
  if (!data.ok) {
    return jsonResponse(
      { error: data.error ?? slackMethod, ok: false },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }
  return okResponse(ctx.creds, ctx.acceptEncoding);
}

export const messageActionRoutes: Route[] = [
  route("POST", "/api/messages/:channel/:ts/reactions", async (ctx) => {
    const { name } = (await ctx.body.json()) as { name?: string };
    if (!name) return errorResponse("invalid_reaction", 400);
    return mutate(
      "reactions.add",
      { channel: ctx.params.channel, name, timestamp: ctx.params.ts },
      ctx,
    );
  }),
  route("DELETE", "/api/messages/:channel/:ts/reactions", async (ctx) => {
    const { name } = (await ctx.body.json()) as { name?: string };
    if (!name) return errorResponse("invalid_reaction", 400);
    return mutate(
      "reactions.remove",
      { channel: ctx.params.channel, name, timestamp: ctx.params.ts },
      ctx,
    );
  }),
  route("POST", "/api/messages/:channel/:ts/pin", (ctx) =>
    mutate("pins.add", { channel: ctx.params.channel, timestamp: ctx.params.ts }, ctx),
  ),
  route("DELETE", "/api/messages/:channel/:ts/pin", (ctx) =>
    mutate("pins.remove", { channel: ctx.params.channel, timestamp: ctx.params.ts }, ctx),
  ),
  route("GET", "/api/channels/:id/pins", async (ctx) => {
    const data = await fetchSlack("pins.list", { channel: ctx.params.id }, ctx.creds);
    if (!data.ok) {
      return jsonResponse(
        { error: data.error ?? "pins.list", ok: false },
        ctx.creds,
        ctx.acceptEncoding,
      );
    }
    const items: any[] = Array.isArray(data.items) ? data.items : [];
    return jsonResponse(
      {
        items: items.map((item) => ({
          message: item.type === "message" && item.message ? trimMessage(item.message) : undefined,
          ts: item.message?.ts ?? item.created ?? item.channel,
        })),
        ok: true,
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
  route("POST", "/api/channels/:id/star", (ctx) =>
    mutate("stars.add", { channel: ctx.params.id }, ctx),
  ),
  route("DELETE", "/api/channels/:id/star", (ctx) =>
    mutate("stars.remove", { channel: ctx.params.id }, ctx),
  ),
  route("POST", "/api/messages/:channel/:ts/save", (ctx) =>
    mutate(
      "saved.add",
      { item_id: ctx.params.channel, item_type: "message", ts: ctx.params.ts },
      ctx,
    ),
  ),
  route("DELETE", "/api/messages/:channel/:ts/save", (ctx) =>
    mutate(
      "saved.delete",
      { item_id: ctx.params.channel, item_type: "message", ts: ctx.params.ts },
      ctx,
    ),
  ),
  route("GET", "/api/saved", async (ctx) => {
    const data = await fetchSlack("saved.list", { limit: "40" }, ctx.creds);
    if (!data.ok) {
      return jsonResponse(
        { error: data.error ?? "saved.list", ok: false },
        ctx.creds,
        ctx.acceptEncoding,
      );
    }
    // saved.list returns `saved_items`, each shaped like { item_id (the
    // channel), item_type: 'message', ts, ... } — item_id/ts sit at the top
    // level, not nested.
    const items: any[] = data.saved_items ?? data.items ?? [];
    const normalized = items
      .filter((item) => !item.item_type || item.item_type === "message")
      .map((item) => ({
        channelId: item.item_id ?? item.channel_id ?? item.channel,
        ts: item.ts ?? item.message_ts,
      }))
      .filter((item) => !!item.channelId && !!item.ts);
    return jsonResponse({ items: normalized, ok: true }, ctx.creds, ctx.acceptEncoding);
  }),
  route("POST", "/api/reminders", async (ctx) => {
    const requestBody = (await ctx.body.json()) as {
      text?: string;
      time?: string;
      channelId?: string;
      ts?: string;
      dateDue?: number;
    };
    // Reminders tied to a specific message use the item_type/item_id/ts/date_due
    // shape (matches Slack's own message-reminder menu) rather than the
    // free-text text/time form `/remind` uses.
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
