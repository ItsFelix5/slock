import { teamIdFromRoute } from "../../auth.ts";
import { jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack, callSlackEdge } from "../../slackClient.ts";
import { trimChannel, trimFile, trimUser } from "../../trim/slackEntities.ts";
import { type Route, route } from "../router.ts";

export const searchRoutes: Route[] = [
  route("GET", "/api/search", async (ctx) => {
    let query = (ctx.searchParams.get("query") ?? "").trim();
    if (!query)
      return jsonResponse(
        { channels: [], files: [], ok: true, users: [] },
        ctx.creds,
        ctx.acceptEncoding,
      );
    const scope =
      query[0] === "#"
        ? "channels"
        : query[0] === "@"
          ? "users"
          : query[0] === "§"
            ? "files"
            : "all";
    if (scope !== "all") query = query.slice(1).trim();

    //todo users/search
    //channels/search
    //search.autocomplete.files query include_shares
    const [peopleData, channelsData, filesData] = await Promise.all([
      scope === "channels" || scope === "files"
        ? Promise.resolve({ items: [], ok: true })
        : callSlack("search.modules.people", { count: "30", module: "people", query }, ctx.creds),
      scope === "files" || scope === "users"
        ? Promise.resolve({ results: [] })
        : callSlackEdge(
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
          ),
      scope === "channels" || scope === "users"
        ? Promise.resolve({ items: [], ok: true })
        : callSlack(
            "search.modules.files",
            {
              count: "20",
              extra_message_data: "1",
              extracts: "1",
              file_title_only: "false",
              highlight: "1",
              include_files_shares: "1",
              max_extract_len: "200",
              module: "files",
              no_user_profile: "1",
              page: "1",
              query,
              query_rewrite_disabled: "false",
              search_context: "desktop_files_search",
              search_exclude_bots: "false",
              search_only_my_channels: "false",
              sort: "timestamp",
              sort_dir: "desc",
            },
            ctx.creds,
          ),
    ]);
    if (!peopleData.ok)
      return slackErrorResponse(peopleData, "search.modules.people", ctx.creds, ctx.acceptEncoding);
    if (!Array.isArray(channelsData.results))
      return slackErrorResponse(
        channelsData,
        "edge channels/search",
        ctx.creds,
        ctx.acceptEncoding,
      );
    if (!filesData.ok)
      return slackErrorResponse(filesData, "search.modules.files", ctx.creds, ctx.acceptEncoding);
    return jsonResponse(
      {
        channels: channelsData.results.map(trimChannel),
        files: (Array.isArray(filesData.items) ? filesData.items : []).map(trimFile),
        ok: true,
        users: (Array.isArray(peopleData.items) ? peopleData.items : []).map(trimUser),
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("GET", "/api/search/messages", async (ctx) => {
    const query = ctx.searchParams.get("query")?.trim();
    if (!query) return jsonResponse({ ok: true, results: [] }, ctx.creds, ctx.acceptEncoding);
    const sort = ctx.searchParams.get("sort") === "score" ? "score" : "timestamp";
    const sortDir = ctx.searchParams.get("sortDir") === "asc" ? "asc" : "desc";
    const data = await callSlack(
      "search.messages",
      { count: "40", query, sort, sort_dir: sortDir },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "search.messages", ctx.creds, ctx.acceptEncoding);
    }
    const matches: any[] = data.messages?.matches ?? [];
    return jsonResponse(
      {
        ok: true,
        results: matches
          .filter((match) => !!(match?.channel?.id && match.ts))
          .map((match) => ({
            channelId: match.channel.id,
            channelName: match.channel.name ?? match.channel.id,
            text: match.text ?? "",
            threadTs: match.thread_ts || undefined,
            ts: match.ts,
            userId: match.user ?? "",
          })),
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("GET", "/api/search/autocomplete", async (ctx) => {
    const query = ctx.searchParams.get("query")?.trim();
    if (!query) return jsonResponse({ ok: true, suggestions: [] }, ctx.creds, ctx.acceptEncoding);
    const data = await callSlack("search.autocomplete", { query }, ctx.creds);
    if (!data.ok) return jsonResponse({ ok: true, suggestions: [] }, ctx.creds, ctx.acceptEncoding);
    return jsonResponse(
      { ok: true, suggestions: data.suggestions?.text ?? [] },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
];
