// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import { trimChannel } from "../../trim/slackEntities.ts";
import { mutate, type Route, type RouteCtx, route } from "../router.ts";

export const channelRoutes: Route[] = [
  route("POST", "/api/channels", async (ctx) => {
    const { name, isPrivate } = (await ctx.body.json()) as { name?: string; isPrivate?: boolean };
    if (!name) return errorResponse("invalid_name", 400);
    const data = await callSlack(
      "conversations.create",
      { is_private: isPrivate ? "true" : "false", name },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.create", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(
      { channel: trimChannel(data.channel), ok: true },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("GET", "/api/channels/:id", async (ctx) => {
    const data = await callSlack(
      "conversations.info",
      { channel: ctx.params.id, include_num_members: "true" },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.info", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(
      { channel: trimChannel(data.channel), ok: true },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("PATCH", "/api/channels/:id", async (ctx) => {
    const { name } = (await ctx.body.json()) as { name?: string };
    if (!name) return errorResponse("invalid_name", 400);
    const data = await callSlack(
      "conversations.rename",
      { channel: ctx.params.id, name },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.rename", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(
      { channel: { name: data.channel?.name ?? name }, ok: true },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("PUT", "/api/channels/:id/purpose", async (ctx) => {
    const { purpose } = (await ctx.body.json()) as { purpose?: string };
    if (purpose === undefined) return errorResponse("invalid_purpose", 400);
    return mutate("conversations.setPurpose", { channel: ctx.params.id, purpose }, ctx);
  }),

  route("PUT", "/api/channels/:id/topic", async (ctx) => {
    const { topic } = (await ctx.body.json()) as { topic?: string };
    if (topic === undefined) return errorResponse("invalid_topic", 400);
    return mutate("conversations.setTopic", { channel: ctx.params.id, topic }, ctx);
  }),

  route("PUT", "/api/channels/:id/retention", async (ctx) => {
    const { days } = (await ctx.body.json()) as { days?: number | null };
    return mutate(
      "conversations.setRetention",
      {
        channel: ctx.params.id,
        retention_duration: String(days ?? 0),
        retention_type: days ? "1" : "0",
      },
      ctx,
    );
  }),

  route("PUT", "/api/channels/:id/member-permissions", async (ctx) => {
    const { permissions } = (await ctx.body.json()) as {
      permissions?: { is_allowed: boolean; permission: string }[];
    };
    if (!permissions?.length) return okNoop(ctx);
    return mutate(
      "conversations.permissions.accountTypes.set",
      {
        account_type: "FULL_MEMBER",
        channel_id: ctx.params.id,
        permissions: JSON.stringify(permissions),
      },
      ctx,
    );
  }),

  route("GET", "/api/channels/:id/posting-prefs", async (ctx) => {
    const data = await callSlack("channels.prefs.get", { channel_id: ctx.params.id }, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "channels.prefs.get", ctx.creds, ctx.acceptEncoding);
    }
    const prefs = data.prefs ?? data;
    return jsonResponse(
      {
        ok: true,
        prefs:
          prefs && typeof prefs === "object"
            ? {
                can_thread: prefs.can_thread,
                enable_at_channel: prefs.enable_at_channel,
                enable_at_here: prefs.enable_at_here,
                who_can_post: prefs.who_can_post,
              }
            : prefs,
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("PUT", "/api/channels/:id/posting-prefs", async (ctx) => {
    const { prefs } = (await ctx.body.json()) as { prefs?: Record<string, string> };
    if (!prefs) return errorResponse("invalid_prefs", 400);
    return mutate(
      "channels.prefs.set",
      { channel_id: ctx.params.id, prefs: JSON.stringify(prefs) },
      ctx,
    );
  }),

  route("POST", "/api/channels/:id/join", (ctx) =>
    mutateChannel("conversations.join", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "/api/channels/:id/leave", (ctx) =>
    mutate("conversations.leave", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "/api/channels/:id/archive", (ctx) =>
    mutate("conversations.archive", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "/api/channels/:id/unarchive", (ctx) =>
    mutate("conversations.unarchive", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "/api/channels/:id/convert-to-private", (ctx) =>
    mutate("conversations.convertToPrivate", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "/api/channels/:id/close", (ctx) =>
    mutate("conversations.close", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "/api/channels/:id/members", async (ctx) => {
    const { userIds } = (await ctx.body.json()) as { userIds?: string[] };
    if (!userIds?.length) return errorResponse("invalid_user_ids", 400);
    return mutate(
      "conversations.invite",
      { channel: ctx.params.id, users: userIds.join(",") },
      ctx,
    );
  }),

  route("DELETE", "/api/channels/:id/members/:userId", (ctx) =>
    mutate("conversations.kick", { channel: ctx.params.id, user: ctx.params.userId }, ctx),
  ),
];

async function mutateChannel(
  slackMethod: string,
  params: Record<string, string>,
  ctx: RouteCtx,
): Promise<Response> {
  const data = await callSlack(slackMethod, params, ctx.creds);
  if (!data.ok) return slackErrorResponse(data, slackMethod, ctx.creds, ctx.acceptEncoding);
  return jsonResponse(
    { channel: trimChannel(data.channel), ok: true },
    ctx.creds,
    ctx.acceptEncoding,
  );
}

function okNoop(ctx: RouteCtx): Response {
  return jsonResponse({ ok: true }, ctx.creds, ctx.acceptEncoding);
}
