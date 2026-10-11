import type { Setup } from "@slock/core";
import { jsonResponse, slackErrorResponse } from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { FilesSearchReply, LinksSearchReply } from "../../slack/server/api/slackReplies";

const list: Route[] = [
  route("GET", "channels/:id/files-links", async (ctx) => {
    const channelId = ctx.params.id;
    const channelName = ctx.searchParams.get("channelName")?.trim() ?? "";
    const query = ctx.searchParams.get("query")?.trim() ?? "";
    const page = Math.max(1, Number.parseInt(ctx.searchParams.get("page") ?? "1", 10) || 1);
    const filesQuery = `in:<#${channelId}${channelName ? `|${channelName}` : ""}> ${query}`.trim();
    const [filesData, linksData] = await Promise.all([
      callSlack<FilesSearchReply>(
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
          page: String(page),
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
      callSlack<LinksSearchReply>(
        "conversations.searchLinks",
        {
          channel_id: channelId,
          page: String(page),
          query,
          sort: "timestamp",
          sort_dir: "desc",
        },
        ctx.creds,
      ),
    ]);
    if (!filesData.ok) {
      return slackErrorResponse(filesData, "search.modules.files", ctx.creds);
    }
    if (!linksData.ok) {
      return slackErrorResponse(linksData, "conversations.searchLinks", ctx.creds);
    }
    return jsonResponse(
      {
        files: filesData.items ?? [],
        filesTotal: filesData.pagination?.total_count ?? 0,
        hasMore:
          page * 50 < (filesData.pagination?.total_count ?? 0) ||
          page * 50 < (linksData.pagination?.total_count ?? 0),
        links: linksData.items ?? [],
        linksTotal: linksData.pagination?.total_count ?? 0,
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
