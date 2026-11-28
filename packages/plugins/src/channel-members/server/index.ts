import type { Setup } from "@slock/core";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { mutate, route, routes } from "@slock/plugins/slack/server/api/router";
import { callSlackEdge } from "@slock/plugins/slack/server/api/slackClient";
import type { EdgeUsersReply } from "@slock/plugins/slack/server/api/slackReplies";
import { trimUser } from "@slock/plugins/slack/server/api/trim/slackEntities";

const PEOPLE_PAGE_SIZE = 100;
// Slack answers at most 500 ids per presence_query.
const PEOPLE_MAX_PAGES = 5;

const unreadable = (error: string | undefined) =>
  error === "not_in_channel" || error === "channel_not_found";

const list: Route[] = [
  route("GET", "channels/:id/people-count", async (ctx) => {
    const data = await callSlackEdge<{ counts?: { people?: number } }>(
      "users/counts",
      { as_admin: false, channel: ctx.params.id },
      ctx.creds,
    );
    if (!(data.ok || unreadable(data.error))) return slackErrorResponse(data, "edge users/counts");
    return jsonResponse({ ok: true, people: data.ok ? data.counts?.people : undefined });
  }),

  route("GET", "channels/:id/people", async (ctx) => {
    const ids: string[] = [];
    let marker: string | undefined;
    for (let page = 0; page < PEOPLE_MAX_PAGES; page++) {
      const data = await callSlackEdge<EdgeUsersReply>(
        "users/list",
        {
          channels: [ctx.params.id],
          count: PEOPLE_PAGE_SIZE,
          filter: "everyone AND NOT bots AND NOT apps",
          present_first: false,
          ...(marker ? { marker } : {}),
        },
        ctx.creds,
      );
      if (!data.ok) {
        if (unreadable(data.error)) break;
        return slackErrorResponse(data, "edge users/list");
      }
      for (const user of data.results ?? []) if (!user.deleted) ids.push(user.id);
      marker = data.next_marker;
      if (!marker) break;
    }
    return jsonResponse({ complete: !marker, ids, ok: true });
  }),

  route("GET", "channels/:id/members", async (ctx) => {
    const filter = ctx.searchParams.get("filter") === "apps" ? "apps" : "everyone";
    const marker = ctx.searchParams.get("marker") ?? undefined;
    const query = ctx.searchParams.get("query")?.trim();
    const data = await callSlackEdge<EdgeUsersReply>(
      query ? "users/search" : "users/list",
      query
        ? {
            channels: [ctx.params.id],
            count: 50,
            filter: "people OR apps",
            fuzz: 1,
            include_profile_only_users: true,
            index: "users_by_display_name",
            locale: "en-US",
            present_first: false,
            query,
            search_profile_fields: true,
          }
        : {
            channels: [ctx.params.id],
            count: 50,
            filter,
            present_first: false,
            ...(marker ? { marker } : {}),
          },
      ctx.creds,
    );
    if (!(data.ok || unreadable(data.error))) {
      return slackErrorResponse(data, "edge users/list");
    }
    return jsonResponse({
      next_marker: data.ok ? data.next_marker : undefined,
      ok: true,
      results: (data.ok ? (data.results ?? []) : []).map(trimUser),
    });
  }),

  route("POST", "channels/:id/members", async (ctx) => {
    const { userIds } = await ctx.body.json<{ userIds?: string[] }>();
    if (!userIds?.length) return errorResponse("invalid_user_ids", 400);
    return mutate(
      "conversations.invite",
      { channel: ctx.params.id, users: userIds.join(",") },
      ctx,
    );
  }),

  route("DELETE", "channels/:id/members/:userId", (ctx) =>
    mutate("conversations.kick", { channel: ctx.params.id, user: ctx.params.userId }, ctx),
  ),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
