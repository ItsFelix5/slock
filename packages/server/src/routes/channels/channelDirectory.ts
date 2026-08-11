// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { teamIdFromRoute } from "../../auth.ts";
import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { lookupFlaronChannel } from "../../lookup/flaronChannel.ts";
import { callSlack, callSlackEdge } from "../../slackClient.ts";
import { trimChannel, trimUser } from "../../trim/slackEntities.ts";
import { type Route, route } from "../router.ts";

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
    // A single unresolvable id (foreign/deleted channel) makes Slack fail the
    // *whole* batch with channel_not_found instead of nulling just that id —
    // treat it as "nothing cached" so co-batched ids still get a real answer
    // (and a shot at the Flaron fallback below) instead of every id in the
    // batch rejecting and retrying in lockstep forever.
    if (!data.ok && data.error !== "channel_not_found") {
      return slackErrorResponse(data, "edge channels/info", ctx.creds, ctx.acceptEncoding);
    }
    const entries = await Promise.all(
      ids.map(async (id) => {
        const raw = data.ok ? cachedChannelForId(data, id) : undefined;
        if (raw?.id) return [id, trimChannel(raw)] as const;
        // Not visible to this workspace's Slack API (cross-workspace/shared
        // link) — Flaron's public directory is stateless, so it's cheap to
        // check in the same request rather than round-tripping the client.
        const flaron = await lookupFlaronChannel(id);
        return [
          id,
          flaron
            ? { id: flaron.id, is_private: flaron.private, name: flaron.name, topic: flaron.topic }
            : null,
        ] as const;
      }),
    );
    return jsonResponse(
      { channels: Object.fromEntries(entries), ok: true },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  // search.modules.channels only indexes channels the caller is already a
  // member of — the edge cache's channels/search is what the real client
  // uses for #-mention/browse autocomplete, and it covers the whole
  // workspace's public channels too. Its response is a bare array, not the
  // usual {ok, ...} envelope.
  route("GET", "/api/channels/browse", async (ctx) => {
    const query = ctx.searchParams.get("query")?.trim();
    if (!query) return jsonResponse({ items: [], ok: true }, ctx.creds, ctx.acceptEncoding);
    const { results } = await callSlackEdge(
      "channels/search",
      {
        check_membership: true,
        count: 40,
        default_workspace: ctx.creds ? teamIdFromRoute(ctx.creds.route) : undefined,
        filter: "xws",
        fuzz: 1,
        include_record_channels: false,
        query,
      },
      ctx.creds,
    );
    if (!Array.isArray(results)) {
      return slackErrorResponse(results, "edge channels/search", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(
      { items: results.map(trimChannel), ok: true },
      ctx.creds,
      ctx.acceptEncoding,
    );
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

  // Backs the channel header's "Files & links" panel. Slack's own client
  // splits this into three calls (media files, non-media files, links) across
  // tabs; we show everything in one merged list, so one search.modules.files
  // call (no type: filter) plus conversations.searchLinks covers it.
  route("GET", "/api/channels/:id/files-links", async (ctx) => {
    const channelId = ctx.params.id;
    const channelName = ctx.searchParams.get("channelName")?.trim() ?? "";
    const query = ctx.searchParams.get("query")?.trim() ?? "";
    const filesQuery = `in:<#${channelId}${channelName ? `|${channelName}` : ""}> ${query}`.trim();
    const [filesData, linksData] = await Promise.all([
      callSlack(
        "search.modules.files",
        {
          count: "50",
          extra_message_data: "1",
          extracts: "1",
          file_title_only: "false",
          highlight: "1",
          include_files_shares: "1",
          max_extract_len: "200",
          max_filter_suggestions: "10",
          module: "files",
          no_user_profile: "1",
          page: "1",
          query: filesQuery,
          query_rewrite_disabled: "false",
          search_context: "desktop_files_channel_tab",
          search_exclude_bots: "false",
          search_only_my_channels: "false",
          sort: "timestamp",
          sort_dir: "desc",
        },
        ctx.creds,
      ),
      callSlack(
        "conversations.searchLinks",
        { channel_id: channelId, page: "1", query, sort: "timestamp", sort_dir: "desc" },
        ctx.creds,
      ),
    ]);
    if (!filesData.ok) {
      return slackErrorResponse(filesData, "search.modules.files", ctx.creds, ctx.acceptEncoding);
    }
    if (!linksData.ok) {
      return slackErrorResponse(
        linksData,
        "conversations.searchLinks",
        ctx.creds,
        ctx.acceptEncoding,
      );
    }
    return jsonResponse(
      {
        files: Array.isArray(filesData.items) ? filesData.items : [],
        filesTotal: filesData.pagination?.total_count ?? 0,
        links: Array.isArray(linksData.items) ? linksData.items : [],
        linksTotal: linksData.pagination?.total_count ?? 0,
        ok: true,
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
