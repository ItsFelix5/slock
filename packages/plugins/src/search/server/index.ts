import type { Setup } from "@slock/core";
import { defined } from "@slock/core";
import { teamIdFromRoute } from "@slock/plugins/slack/server/api/auth";
import { jsonResponse, slackErrorResponse } from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { mutate, route, routes } from "@slock/plugins/slack/server/api/router";
import type { SlackReply } from "@slock/plugins/slack/server/api/slackClient";
import { callSlack, callSlackEdge } from "@slock/plugins/slack/server/api/slackClient";
import type {
  EdgeChannelsReply,
  EdgeUsersReply,
  FilesSearchReply,
  MessagesSearchReply,
  SearchMessageMatch,
} from "@slock/plugins/slack/server/api/slackReplies";
import { isHostedChannel, trimChannel } from "@slock/plugins/slack/server/api/trim/slackChannels";
import { trimUser } from "@slock/plugins/slack/server/api/trim/slackEntities";
import { trimFile } from "@slock/plugins/slack/server/api/trim/slackMessages";

function threadTsFromMatch(match: { permalink?: string; thread_ts?: string }): string | undefined {
  if (match.thread_ts) return match.thread_ts;
  if (!(match.permalink && URL.canParse(match.permalink))) return;
  return new URL(match.permalink).searchParams.get("thread_ts") || undefined;
}

function extractHighlights(raw: string): { highlights: string[]; text: string } {
  const parts = raw.split(HIGHLIGHT_MARKER);
  if (parts.length === 1) return { highlights: [], text: raw };
  const highlights = new Set<string>();
  const [first, ...rest] = parts;
  let text = defined(first);
  for (const [i, part] of rest.entries()) {
    if (i % 2 === 0) highlights.add(part);
    text += part;
  }
  return { highlights: [...highlights], text };
}

const NO_USERS: SlackReply<EdgeUsersReply> = { ok: true, results: [] };

const NO_CHANNELS: SlackReply<EdgeChannelsReply> = { ok: true, results: [] };

const NO_FILES: SlackReply<FilesSearchReply> = { items: [], ok: true };

function botIconFromMatch(match: SearchMessageMatch): string | undefined {
  return (
    match.icons?.image_72 ??
    match.icons?.image_48 ??
    match.icons?.image_36 ??
    match.bot_profile?.icons?.image_72 ??
    match.bot_profile?.icons?.image_48 ??
    match.bot_profile?.icons?.image_36
  );
}

const HIGHLIGHT_MARKER = /[\uE000-\uF8FF]/;

const list: Route[] = [
  route("GET", "search", async (ctx) => {
    let query = (ctx.searchParams.get("query") ?? "").trim();
    if (!query) return jsonResponse({ channels: [], files: [], ok: true, users: [] });
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
        ? Promise.resolve(NO_USERS)
        : callSlackEdge<EdgeUsersReply>(
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
        ? Promise.resolve(NO_CHANNELS)
        : callSlackEdge<EdgeChannelsReply>(
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
        ? Promise.resolve(NO_FILES)
        : callSlack<FilesSearchReply>(
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
    if (!peopleData.ok) return slackErrorResponse(peopleData, "users.search");
    if (!channelsData.ok) return slackErrorResponse(channelsData, "edge channels/search");
    if (!filesData.ok) return slackErrorResponse(filesData, "search.modules.files");
    return jsonResponse({
      channels: (channelsData.results ?? [])
        .filter((channel) => !isHostedChannel(channel))
        .map(trimChannel),
      files: (filesData.items ?? []).map(trimFile),
      ok: true,
      users: (peopleData.results ?? []).map(trimUser),
    });
  }),

  route("GET", "search/messages", async (ctx) => {
    const query = ctx.searchParams.get("query")?.trim();
    if (!query) return jsonResponse({ ok: true, results: [] });
    const sort = ctx.searchParams.get("sort") === "score" ? "score" : "timestamp";
    const sortDir = ctx.searchParams.get("sortDir") === "asc" ? "asc" : "desc";
    const data = await callSlack<MessagesSearchReply>(
      "search.modules.messages",
      {
        count: "40",
        extra_message_data: "1",
        highlight: "1",
        module: "messages",
        no_user_profile: "1",
        page: "1",
        query,
        query_rewrite_disabled: "false",
        search_context: "desktop_messages_tab",
        search_exclude_bots: "false",
        search_only_my_channels: "false",
        spell_correction: "FUZZY_MATCH",
        sort,
        sort_dir: sortDir,
      },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "search.modules.messages");
    }
    const matches = (data.items ?? []).flatMap((group) =>
      group.channel && !isHostedChannel(group.channel)
        ? (group.messages ?? []).map((message) => ({ ...message, channel: group.channel }))
        : [],
    );
    return jsonResponse({
      ok: true,
      results: matches
        .flatMap((match) =>
          match.channel?.id && match.ts ? [{ ...match, channel: match.channel, ts: match.ts }] : [],
        )
        .map((match) => {
          const { highlights, text } = extractHighlights(match.text ?? "");
          return {
            blocks: match.blocks,
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
    });
  }),

  route("POST", "search/save", async (ctx) => {
    const { query } = await ctx.body.json<{ query?: string }>();
    if (!query?.trim()) return jsonResponse({ ok: true });
    return mutate("search.save", { module: "messages", query: query.trim() }, ctx);
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
