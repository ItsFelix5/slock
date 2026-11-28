import type { Setup } from "@slock/core";
import { jsonResponse, slackErrorResponse } from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { route, routes } from "@slock/plugins/slack/server/api/router";
import { searchModule } from "@slock/plugins/slack/server/api/searchModules";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import { trimFile } from "@slock/plugins/slack/server/api/trim/slackMessages";
import type { RawFile, RawLink } from "@slock/types";

const list: Route[] = [
  route("GET", "channels/:id/files-links", async (ctx) => {
    const channelId = ctx.params.id;
    const channelName = ctx.searchParams.get("channelName")?.trim() ?? "";
    const query = ctx.searchParams.get("query")?.trim() ?? "";
    const page = Math.max(1, Number.parseInt(ctx.searchParams.get("page") ?? "1", 10) || 1);
    const filesQuery = `in:<#${channelId}${channelName ? `|${channelName}` : ""}> ${query}`.trim();
    const [filesData, linksData] = await Promise.all([
      searchModule<RawFile>(
        "files",
        {
          context: "desktop_files_channel_tab",
          count: 50,
          page,
          query: filesQuery,
          sort: "timestamp",
          sortDir: "desc",
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
      return slackErrorResponse(filesData, "search.modules.files");
    }
    if (!linksData.ok) {
      return slackErrorResponse(linksData, "conversations.searchLinks");
    }
    return jsonResponse({
      files: (filesData.items ?? []).map(trimFile),
      filesTotal: filesData.pagination?.total_count ?? 0,
      hasMore:
        page * 50 < (filesData.pagination?.total_count ?? 0) ||
        page * 50 < (linksData.pagination?.total_count ?? 0),
      links: linksData.items ?? [],
      linksTotal: linksData.pagination?.total_count ?? 0,
      ok: true,
    });
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;

type LinksSearchReply = {
  items?: RawLink[];
  pagination?: { total_count?: number };
};
