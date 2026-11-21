import type { Setup } from "@slock/core";
import { teamIdFromRoute } from "@slock/plugins/slack/server/api/auth";
import { cachedEntityForId } from "@slock/plugins/slack/server/api/cachedEntity";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { mutate, route, routes } from "@slock/plugins/slack/server/api/router";
import { callSlack, callSlackEdge } from "@slock/plugins/slack/server/api/slackClient";
import type {
  EdgeUsergroupsInfoReply,
  UsergroupMembersReply,
} from "@slock/plugins/slack/server/api/slackReplies";
import type { RawUsergroup } from "@slock/types";

function trimUsergroup(group: RawUsergroup): RawUsergroup {
  return {
    created_by: group.created_by,
    date_create: group.date_create,
    description: group.description,
    handle: group.handle,
    id: group.id,
    is_section: group.is_section,
    name: group.name,
    prefs: { channels: group.prefs?.channels, groups: group.prefs?.groups },
    user_count: group.user_count,
  };
}

const list: Route[] = [
  route("POST", "usergroups/lookup", async (ctx) => {
    const { ids } = await ctx.body.json<{ ids?: string[] }>();
    if (!ids?.length) return errorResponse("invalid_ids", 400);
    const data = await callSlackEdge<EdgeUsergroupsInfoReply>(
      "usergroups/info",
      { ids },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "edge usergroups/info");
    }
    return jsonResponse({
      ok: true,
      usergroups: Object.fromEntries(
        ids.map((id) => {
          const group = cachedEntityForId(
            { index: data.usergroups, results: data.results, single: data.usergroup },
            id,
          );
          return [id, group ? trimUsergroup(group) : null];
        }),
      ),
    });
  }),

  route("POST", "usergroups", async (ctx) => {
    const { name } = await ctx.body.json<{ name?: string }>();
    if (!name) return errorResponse("invalid_name", 400);
    const data = await callSlack<{ usergroup?: RawUsergroup }>(
      "usergroups.create",
      { name, team_id: teamIdFromRoute(ctx.creds?.route ?? "") },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "usergroups.create");
    return jsonResponse({ id: data.usergroup?.id, ok: true });
  }),

  route("GET", "usergroups/:id/members", async (ctx) => {
    const data = await callSlack<UsergroupMembersReply>(
      "usergroups.users.list",
      {
        usergroup: ctx.params.id,
      },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "usergroups.users.list");
    }
    return jsonResponse({ ok: true, userIds: data.users ?? [] });
  }),

  route("PATCH", "usergroups/:id", async (ctx) => {
    const body = await ctx.body.json<{
      name?: string;
      handle?: string;
      description?: string;
      channelIds?: string[];
      sectionEnabled?: boolean;
    }>();
    const params: Record<string, string> = { usergroup: ctx.params.id };
    if (body.name !== undefined) params.name = body.name;
    if (body.handle !== undefined) params.handle = body.handle;
    if (body.description !== undefined) params.description = body.description;
    if (body.channelIds !== undefined) params.channels = body.channelIds.join(",");
    if (body.sectionEnabled !== undefined) params.enable_section = String(body.sectionEnabled);
    if (Object.keys(params).length === 1) return errorResponse("invalid_patch", 400);
    return mutate("usergroups.update", params, ctx);
  }),

  route("PUT", "usergroups/:id/members", async (ctx) => {
    const { userIds } = await ctx.body.json<{ userIds?: string[] }>();
    if (!userIds) return errorResponse("invalid_user_ids", 400);
    return mutate(
      "usergroups.users.update",
      { usergroup: ctx.params.id, users: userIds.join(",") },
      ctx,
    );
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
