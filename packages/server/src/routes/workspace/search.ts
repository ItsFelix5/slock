import { teamIdFromRoute } from "../../auth.ts";
import { jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack, callSlackEdge } from "../../slackClient.ts";
import { trimChannel, trimFile, trimUser } from "../../trim/slackEntities.ts";
import { type Route, route } from "../router.ts";

function threadTsFromMatch(match: { permalink?: string; thread_ts?: string }): string | undefined {
  if (match.thread_ts) return match.thread_ts;
  if (!match.permalink) return;
  try {
    return new URL(match.permalink).searchParams.get("thread_ts") || undefined;
  } catch {}
}

const HIGHLIGHT_MARKER = /[-]/;

function extractHighlights(raw: string): { highlights: string[]; text: string } {
  const parts = raw.split(HIGHLIGHT_MARKER);
  if (parts.length === 1) return { highlights: [], text: raw };
  const highlights = new Set<string>();
  const [first, ...rest] = parts;
  let text = first;
  for (const [i, part] of rest.entries()) {
    if (i % 2 === 0) highlights.add(part);
    text += part;
  }
  return { highlights: [...highlights], text };
}

function botIconFromMatch(match: any): string | undefined {
  return (
    match.icons?.image_72 ??
    match.icons?.image_48 ??
    match.icons?.image_36 ??
    match.bot_profile?.icons?.image_72 ??
    match.bot_profile?.icons?.image_48 ??
    match.bot_profile?.icons?.image_36
  );
}

export const searchRoutes: Route[] = [
  route("GET", "search", async (ctx) => {
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

    const [peopleData, channelsData, filesData] = await Promise.all([
      scope === "channels" || scope === "files"
        ? Promise.resolve({ ok: true, results: [] })
        : callSlackEdge(
            "users/search",
            {
              count: 30,
              default_workspace: ctx.creds ? teamIdFromRoute(ctx.creds.route) : undefined,
              enable_workspace_ranking: true,
              fuzz: 1,
              include_profile_only_users: true,
              query,
            },
            ctx.creds,
          ),
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
      return slackErrorResponse(peopleData, "users.search", ctx.creds, ctx.acceptEncoding);
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
        users: (Array.isArray(peopleData.results) ? peopleData.results : []).map(trimUser),
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("GET", "search/messages", async (ctx) => {
    const query = ctx.searchParams.get("query")?.trim();
    if (!query) return jsonResponse({ ok: true, results: [] }, ctx.creds, ctx.acceptEncoding);
    const sort = ctx.searchParams.get("sort") === "score" ? "score" : "timestamp";
    const sortDir = ctx.searchParams.get("sortDir") === "asc" ? "asc" : "desc";
    const data = await callSlack(
      "search.modules.messages",
      {
        count: "40",
        extra_message_data: "1",
        module: "messages",
        no_user_profile: "1",
        page: "1",
        query,
        query_rewrite_disabled: "false",
        search_context: "desktop_messages_tab",
        search_exclude_bots: "false",
        search_only_my_channels: "false",
        sort,
        sort_dir: sortDir,
      },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "search.modules.messages", ctx.creds, ctx.acceptEncoding);
    }
    const groups: any[] = Array.isArray(data.items) ? data.items : [];
    const matches = groups.flatMap((group) =>
      (Array.isArray(group?.messages) ? group.messages : []).map((message: any) => ({
        ...message,
        channel: group.channel,
      })),
    );
    return jsonResponse(
      {
        ok: true,
        results: matches
          .filter((match) => !!(match?.channel?.id && match.ts))
          .map((match) => {
            const { highlights, text } = extractHighlights(match.text ?? "");
            return {
              botIcon: botIconFromMatch(match),
              botId: match.bot_id,
              botName: match.username ?? match.bot_profile?.name,
              channelId: match.channel.id,
              channelName: match.channel.name ?? match.channel.id,
              highlights,
              text,
              threadTs: threadTsFromMatch(match),
              ts: match.ts,
              userId: match.user ?? match.bot_id ?? "",
            };
          }),
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("POST", "search/save", async (ctx) => {
    const { query } = await (ctx.body.json() as Promise<{ query?: string }>);
    if (query?.trim()) {
      try {
        await callSlack("search.save", { module: "messages", query: query.trim() }, ctx.creds);
      } catch {}
    }
    return jsonResponse({ ok: true }, ctx.creds, ctx.acceptEncoding);
  }),
];
