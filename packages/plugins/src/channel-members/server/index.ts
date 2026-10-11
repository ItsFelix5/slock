import type { Setup } from "@slock/core";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlackEdge } from "../../slack/server/api/slackClient";
import type { EdgeUsersReply } from "../../slack/server/api/slackReplies";
import { trimUser } from "../../slack/server/api/trim/slackEntities";

const list: Route[] = [
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
    if (!data.ok && data.error !== "not_in_channel" && data.error !== "channel_not_found") {
      return slackErrorResponse(data, "edge users/list", ctx.creds);
    }
    return jsonResponse(
      {
        next_marker: data.ok ? data.next_marker : undefined,
        ok: true,
        results: (data.ok ? (data.results ?? []) : []).map(trimUser),
      },
      ctx.creds,
    );
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
