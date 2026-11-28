import type { Setup } from "@slock/core";
import { jsonResponse, slackErrorResponse } from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route, RouteCtx } from "@slock/plugins/slack/server/api/router";
import { mutate, route, routes } from "@slock/plugins/slack/server/api/router";
import {
  type SearchModuleRequest,
  searchModule,
} from "@slock/plugins/slack/server/api/searchModules";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import { trimFile } from "@slock/plugins/slack/server/api/trim/slackMessages";
import type { RawFile } from "@slock/types";
import { type MessageMatchGroup, searchResults } from "./messages";

const PAGE_SIZE = 25;
const HISTORY_LIMIT = 20;
const USERGROUP_LIMIT = 20;

type HistoryReply = { suggestions?: { hash?: string; text?: string }[] };

type UsergroupsReply = {
  usergroups?: { handle?: string; id: string; name?: string; user_count?: number }[];
};

function trimmedQuery(ctx: RouteCtx): string {
  return ctx.searchParams.get("query")?.trim() ?? "";
}

function pageRequest(ctx: RouteCtx): Omit<SearchModuleRequest, "context"> {
  return {
    count: PAGE_SIZE,
    excludeBots: ctx.searchParams.has("excludeBots"),
    myChannels: ctx.searchParams.has("myChannels"),
    page: Number(ctx.searchParams.get("page")) || 1,
    query: trimmedQuery(ctx),
    sort: ctx.searchParams.get("sort") === "score" ? "score" : "timestamp",
    sortDir: ctx.searchParams.get("sortDir") === "asc" ? "asc" : "desc",
  };
}

async function searchPage<Raw, Item>(
  module: "files" | "messages",
  ctx: RouteCtx,
  map: (items: Raw[]) => Item[],
): Promise<Response> {
  const request = pageRequest(ctx);
  const data = await searchModule<Raw>(
    module,
    { ...request, context: `desktop_${module}_tab` },
    ctx.creds,
  );
  if (!data.ok) return slackErrorResponse(data, `search.modules.${module}`);
  return jsonResponse({
    items: map(data.items ?? []),
    ok: true,
    page: request.page,
    pages: data.pagination?.page_count ?? 0,
    total: data.pagination?.total_count ?? 0,
  });
}

async function fileList(
  method: string,
  params: Record<string, string>,
  ctx: RouteCtx,
): Promise<Response> {
  const data = await callSlack<{ files?: RawFile[] }>(method, params, ctx.creds);
  if (!data.ok) return slackErrorResponse(data, method);
  return jsonResponse({ files: (data.files ?? []).map(trimFile), ok: true });
}

const list: Route[] = [
  route("GET", "search/messages", (ctx) =>
    searchPage<MessageMatchGroup, ReturnType<typeof searchResults>[number]>(
      "messages",
      ctx,
      searchResults,
    ),
  ),

  route("GET", "search/files", (ctx) =>
    searchPage<RawFile, RawFile>("files", ctx, (files) => files.map(trimFile)),
  ),

  route("GET", "search/files/titles", (ctx) =>
    fileList("search.autocomplete.files", { query: trimmedQuery(ctx) }, ctx),
  ),

  route("GET", "search/files/recent", (ctx) =>
    fileList("search.autocomplete.topEngagedFiles", {}, ctx),
  ),

  route("GET", "search/usergroups", async (ctx) => {
    const data = await callSlack<UsergroupsReply>(
      "usergroups.search",
      { count: String(USERGROUP_LIMIT), query: trimmedQuery(ctx) },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "usergroups.search");
    return jsonResponse({
      ok: true,
      usergroups: (data.usergroups ?? []).map((group) => ({
        handle: group.handle ?? "",
        id: group.id,
        memberCount: group.user_count ?? 0,
        title: group.name ?? group.handle ?? group.id,
      })),
    });
  }),

  route("GET", "search/history", async (ctx) => {
    const data = await callSlack<HistoryReply>(
      "search.autocomplete",
      { limit: String(HISTORY_LIMIT), query: "", use_hash: "true" },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "search.autocomplete");
    return jsonResponse({
      entries: (data.suggestions ?? []).flatMap(({ hash, text }) =>
        hash && text ? [{ hash, text }] : [],
      ),
      ok: true,
    });
  }),

  route("POST", "search/history", async (ctx) => {
    const { query } = await ctx.body.json<{ query: string }>();
    return mutate("search.save", { terms: query, type: "default" }, ctx);
  }),

  route("POST", "search/history/delete", async (ctx) => {
    const { hash } = await ctx.body.json<{ hash: string }>();
    return mutate("search.delete", { hash }, ctx);
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
