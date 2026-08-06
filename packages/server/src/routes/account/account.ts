// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { teamIdFromRoute } from "../../auth.ts";
import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { getLastSeen } from "../../presence/lastSeen.ts";
import { callSlack, callSlackEdge } from "../../slackClient.ts";
import { trimBot, trimProfile, trimUser } from "../../trim/slackEntities.ts";
import { mutate, type Route, route } from "../router.ts";

function cachedUserForId(data: any, id: string): any | undefined {
  if (data.users?.[id]) return data.users[id];
  if (Array.isArray(data.results)) return data.results.find((user: any) => user.id === id);
  if (data.results && typeof data.results === "object") {
    if (data.results[id]) return data.results[id];
    return Object.values<any>(data.results).find((user: any) => user?.id === id);
  }
  if (Array.isArray(data.users)) return data.users.find((user: any) => user.id === id);
  return data.user?.id === id ? data.user : undefined;
}

export const accountRoutes: Route[] = [
  // Bot authors (message.bot_id/app_id, no inline bot_profile) aren't valid
  // input to the users cache endpoint below — resolved through bots.info instead.
  route("GET", "/api/bots/:id", async (ctx) => {
    const data = await callSlack("bots.info", { bot: ctx.params.id }, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "bots.info", ctx.creds, ctx.acceptEncoding);
    return jsonResponse({ bot: trimBot(data.bot), ok: true }, ctx.creds, ctx.acceptEncoding);
  }),

  // Batched user-by-id lookup, backed by Slack's edge cache API (the regular
  // users.info Web API method is restricted on Enterprise Grid).
  route("POST", "/api/users/lookup", async (ctx) => {
    const { ids } = (await ctx.body.json()) as { ids?: string[] };
    if (!ids?.length) return errorResponse("invalid_ids", 400);
    const data = await callSlackEdge(
      "users/info",
      {
        include_profile_only_users: true,
        updated_ids: Object.fromEntries(ids.map((id) => [id, 0])),
      },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "edge users/info", ctx.creds, ctx.acceptEncoding);
    }
    const teamId = ctx.creds ? teamIdFromRoute(ctx.creds.route) : null;
    return jsonResponse(
      {
        ok: true,
        users: Object.fromEntries(
          ids.map((id) => {
            const user = cachedUserForId(data, id);
            if (!user) return [id, null];
            const trimmed = trimUser(user);
            const lastSeen = teamId ? getLastSeen(teamId, id) : undefined;
            return [id, lastSeen ? { ...trimmed, last_seen: lastSeen } : trimmed];
          }),
        ),
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  // The edge users/info cache above (used everywhere for cheap avatar/name/status
  // hydration) never carries custom profile field *values* for anyone, self
  // included — only the full users.profile.get call does, so the profile panel
  // fetches it separately instead of paying that cost on every batched lookup.
  route("GET", "/api/users/:id/profile", async (ctx) => {
    const data = await callSlack("users.profile.get", { user: ctx.params.id }, ctx.creds);
    if (!data.ok)
      return slackErrorResponse(data, "users.profile.get", ctx.creds, ctx.acceptEncoding);
    return jsonResponse(
      { ok: true, profile: trimProfile(data.profile) },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  // team.profile.get's field *definitions* (label/ordering) are workspace-wide,
  // separate from each user's field *values*.
  route("GET", "/api/profile-fields", async (ctx) => {
    const data = await callSlack("team.profile.get", {}, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "team.profile.get", ctx.creds, ctx.acceptEncoding);
    }
    const fields: any[] = Array.isArray(data.profile?.fields) ? data.profile.fields : [];
    return jsonResponse(
      {
        fields: fields
          .filter((f) => !f.is_hidden)
          .sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0))
          .map((f) => ({ id: f.id, label: f.label })),
        ok: true,
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("PUT", "/api/profile", async (ctx) => {
    const { profile } = (await ctx.body.json()) as { profile?: Record<string, unknown> };
    if (!profile) return errorResponse("invalid_profile", 400);
    return mutate("users.profile.set", { profile: JSON.stringify(profile) }, ctx);
  }),

  route("PUT", "/api/presence", async (ctx) => {
    const { presence } = (await ctx.body.json()) as { presence?: "auto" | "away" };
    if (!presence) return errorResponse("invalid_presence", 400);
    return mutate("users.setPresence", { presence }, ctx);
  }),

  // Org-wide member search — a live per-query search, so a 100k-member
  // workspace never needs to be paged through and cached locally.
  route("GET", "/api/directory", async (ctx) => {
    const query = ctx.searchParams.get("query")?.trim();
    if (!query) return jsonResponse({ truncated: false, users: [] }, ctx.creds, ctx.acceptEncoding);
    const data = await callSlack(
      "search.modules.people",
      { count: "30", module: "people", query },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "search.modules.people", ctx.creds, ctx.acceptEncoding);
    }
    const items: any[] = Array.isArray(data.items) ? data.items : [];
    return jsonResponse(
      {
        truncated: (data.pagination?.total_count ?? items.length) > items.length,
        users: items.map(trimUser),
        ok: true,
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
];
