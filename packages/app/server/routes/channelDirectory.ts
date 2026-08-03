// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { errorResponse, jsonResponse, slackErrorResponse } from "../http/jsonResponse.ts";
import { callSlack, callSlackEdge } from "../slackClient.ts";
import { trimChannel, trimUser } from "../trim/slackEntities.ts";
import { type Route, route } from "./router.ts";

function cachedChannelForId(data: any, id: string): any | undefined {
  if (data.channels?.[id]) return data.channels[id];
  if (Array.isArray(data.channels)) return data.channels.find((channel: any) => channel.id === id);
  if (data.results?.[id]) return data.results[id];
  if (Array.isArray(data.results)) return data.results.find((channel: any) => channel.id === id);
  return data.channel?.id === id ? data.channel : undefined;
}

export const channelDirectoryRoutes: Route[] = [
  // Batched channel lookup by id, backed by Slack's edge cache API.
  route("POST", "/api/channels/lookup", async (ctx) => {
    const { ids } = (await ctx.body.json()) as { ids?: string[] };
    if (!ids?.length) return errorResponse("invalid_ids", 400);
    const data = await callSlackEdge(
      "channels/info",
      { updated_ids: Object.fromEntries(ids.map((id) => [id, 0])) },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "edge channels/info", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(
      {
        channels: Object.fromEntries(
          ids.map((id) => {
            const raw = cachedChannelForId(data, id);
            return [id, raw?.id ? trimChannel(raw) : null];
          }),
        ),
        ok: true,
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("GET", "/api/channels/browse", async (ctx) => {
    const query = ctx.searchParams.get("query")?.trim();
    if (!query) return jsonResponse({ items: [], ok: true }, ctx.creds, ctx.acceptEncoding);
    const data = await callSlack(
      "search.modules.channels",
      { count: "40", module: "channels", query },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "search.modules.channels", ctx.creds, ctx.acceptEncoding);
    }
    const items: any[] = Array.isArray(data.items) ? data.items : [];
    return jsonResponse({ items: items.map(trimChannel), ok: true }, ctx.creds, ctx.acceptEncoding);
  }),

  route("GET", "/api/channels/:id/members", async (ctx) => {
    const filter = ctx.searchParams.get("filter") === "apps" ? "apps" : "everyone";
    const marker = ctx.searchParams.get("marker") ?? undefined;
    const data = await callSlackEdge(
      "users/list",
      {
        channels: [ctx.params.id],
        count: 50,
        filter,
        present_first: false,
        ...(marker ? { marker } : {}),
      },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "edge users/list", ctx.creds, ctx.acceptEncoding);
    }
    const results: any[] = Array.isArray(data.results) ? data.results : [];
    return jsonResponse(
      {
        next_marker: data.next_marker,
        ok: true,
        results: results.map(trimUser),
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("GET", "/api/channels/:id/managers", async (ctx) => {
    const data = await callSlack(
      "admin.roles.entity.listAssignments",
      { entity_id: ctx.params.id },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(
        data,
        "admin.roles.entity.listAssignments",
        ctx.creds,
        ctx.acceptEncoding,
      );
    }
    const assignments: any[] = Array.isArray(data.role_assignments) ? data.role_assignments : [];
    return jsonResponse(
      { ok: true, userIds: [...new Set(assignments.flatMap((a) => a.users ?? []))] },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
];
