import { teamIdFromRoute } from "../../auth.ts";
import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { getLastSeen, recordSeenActive } from "../../presence/lastSeen.ts";
import { callSlack, callSlackEdge, callSlackMultipart } from "../../slackClient.ts";
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
  route("GET", "/api/bots/:id", async (ctx) => {
    const data = await callSlack("bots.info", { bot: ctx.params.id }, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "bots.info", ctx.creds, ctx.acceptEncoding);
    return jsonResponse({ bot: trimBot(data.bot), ok: true }, ctx.creds, ctx.acceptEncoding);
  }),

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

  route("GET", "/api/users/:id/profile", async (ctx) => {
    const params: Record<string, string> = ctx.params.id === "me" ? {} : { user: ctx.params.id };
    const data = await callSlack("users.profile.get", params, ctx.creds);
    if (!data.ok)
      return slackErrorResponse(data, "users.profile.get", ctx.creds, ctx.acceptEncoding);
    return jsonResponse(
      { ok: true, profile: trimProfile(data.profile) },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("GET", "/api/users/:id/presence", async (ctx) => {
    const data = await callSlack("users.getPresence", { user: ctx.params.id }, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "users.getPresence", ctx.creds, ctx.acceptEncoding);
    }
    const presence = data.presence === "away" ? "away" : "active";
    const teamId = ctx.creds ? teamIdFromRoute(ctx.creds.route) : null;
    if (presence === "active" && teamId) recordSeenActive(teamId, ctx.params.id);
    return jsonResponse({ ok: true, presence }, ctx.creds, ctx.acceptEncoding);
  }),

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
          .map((f) => ({ fieldName: f.field_name, id: f.id, label: f.label })),
        ok: true,
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("PUT", "/api/profile", async (ctx) => {
    const { profile } = (await ctx.body.json()) as {
      profile?: Record<string, unknown>;
    };
    if (!profile) return errorResponse("invalid_profile", 400);
    return mutate("users.profile.set", { profile: JSON.stringify(profile) }, ctx);
  }),

  route("POST", "/api/profile/photo", async (ctx) => {
    const filename = ctx.searchParams.get("filename") ?? "profile-photo";
    const type = ctx.searchParams.get("type") ?? "application/octet-stream";
    if (!type.startsWith("image/")) return errorResponse("invalid_image", 400);
    const bytes = await ctx.body.buffer();
    if (!bytes.length || bytes.length > 10 * 1024 * 1024)
      return errorResponse("invalid_image", 400);
    const data = await callSlackMultipart(
      "users.setPhoto",
      {},
      { bytes, field: "image", filename, type },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "users.setPhoto", ctx.creds, ctx.acceptEncoding);
    const profile = data.profile ?? data.user?.profile;
    return jsonResponse({ ok: true, profile: trimProfile(profile) }, ctx.creds, ctx.acceptEncoding);
  }),

  route("PUT", "/api/presence", async (ctx) => {
    const { presence } = (await ctx.body.json()) as {
      presence?: "auto" | "away";
    };
    if (!presence) return errorResponse("invalid_presence", 400);
    return mutate("users.setPresence", { presence }, ctx);
  }),

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
