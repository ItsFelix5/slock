// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { errorResponse, jsonResponse, slackErrorResponse } from "../http/jsonResponse.ts";
import { fetchSlack, fetchSlackEdge } from "../slackClient.ts";
import { mutate, type Route, route } from "./router.ts";

function trimUsergroup(group: any): any {
  if (!group || typeof group !== "object") return group;
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

function cachedUsergroupForId(data: any, id: string): any | undefined {
  if (data.usergroups?.[id]) return data.usergroups[id];
  if (Array.isArray(data.usergroups)) return data.usergroups.find((group: any) => group.id === id);
  if (Array.isArray(data.results)) return data.results.find((group: any) => group.id === id);
  return data.usergroup?.id === id ? data.usergroup : undefined;
}

export const usergroupRoutes: Route[] = [
  // Batched usergroup-by-id lookup, backed by Slack's edge mention cache —
  // shared by the light @mention name lookup and the richer details panel,
  // which both need the same raw fields.
  route("POST", "/api/usergroups/lookup", async (ctx) => {
    const { ids } = (await ctx.body.json()) as { ids?: string[] };
    if (!ids?.length) return errorResponse("invalid_ids", 400);
    const data = await fetchSlackEdge("usergroups/info", { ids }, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "edge usergroups/info", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(
      {
        ok: true,
        usergroups: Object.fromEntries(
          ids.map((id) => {
            const group = cachedUsergroupForId(data, id);
            return [id, group ? trimUsergroup(group) : null];
          }),
        ),
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  // usergroups/info only carries a member *count*, not the list — this fills
  // that one gap.
  route("GET", "/api/usergroups/:id/members", async (ctx) => {
    const data = await fetchSlack("usergroups.users.list", { usergroup: ctx.params.id }, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "usergroups.users.list", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(
      { ok: true, userIds: Array.isArray(data.users) ? data.users : [] },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  // Covers renaming/re-describing a usergroup, replacing its default
  // channels, and toggling section visibility — all the same Slack method
  // with a different partial body.
  route("PATCH", "/api/usergroups/:id", async (ctx) => {
    const body = (await ctx.body.json()) as {
      name?: string;
      handle?: string;
      description?: string;
      channelIds?: string[];
      sectionEnabled?: boolean;
    };
    const params: Record<string, string> = { usergroup: ctx.params.id };
    if (body.name !== undefined) params.name = body.name;
    if (body.handle !== undefined) params.handle = body.handle;
    if (body.description !== undefined) params.description = body.description;
    if (body.channelIds !== undefined) params.channels = body.channelIds.join(",");
    if (body.sectionEnabled !== undefined) params.enable_section = String(body.sectionEnabled);
    if (Object.keys(params).length === 1) return errorResponse("invalid_patch", 400);
    return mutate("usergroups.update", params, ctx);
  }),

  // Slack has no add/remove member endpoint - this replaces the whole
  // membership list, so callers send the full next set of ids.
  route("PUT", "/api/usergroups/:id/members", async (ctx) => {
    const { userIds } = (await ctx.body.json()) as { userIds?: string[] };
    if (!userIds) return errorResponse("invalid_user_ids", 400);
    return mutate(
      "usergroups.users.update",
      { usergroup: ctx.params.id, users: userIds.join(",") },
      ctx,
    );
  }),
];
