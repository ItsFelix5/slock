import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import { trimChannel } from "../../trim/slackEntities.ts";
import { mutate, type Route, type RouteCtx, route } from "../router.ts";

export const channelRoutes: Route[] = [
  route("POST", "channels", async (ctx) => {
    const { name, isPrivate } = await (ctx.body.json() as Promise<{
      name?: string;
      isPrivate?: boolean;
    }>);
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

  route("GET", "channels/:id", async (ctx) => {
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

  route("PATCH", "channels/:id", async (ctx) => {
    const { name } = await (ctx.body.json() as Promise<{ name?: string }>);
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

  route("PUT", "channels/:id/purpose", async (ctx) => {
    const { purpose } = await (ctx.body.json() as Promise<{ purpose?: string }>);
    if (purpose === undefined) return errorResponse("invalid_purpose", 400);
    return mutate("conversations.setPurpose", { channel: ctx.params.id, purpose }, ctx);
  }),

  route("PUT", "channels/:id/topic", async (ctx) => {
    const { topic } = await (ctx.body.json() as Promise<{ topic?: string }>);
    if (topic === undefined) return errorResponse("invalid_topic", 400);
    return mutate("conversations.setTopic", { channel: ctx.params.id, topic }, ctx);
  }),

  route("GET", "channels/:id/retention", async (ctx) => {
    const data = await callSlack(
      "conversations.getRetention",
      { channel: ctx.params.id },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.getRetention", ctx.creds, ctx.acceptEncoding);
    }
    const days = data.retention_type === "1" ? Number(data.retention_duration) || null : null;
    return jsonResponse({ days, ok: true }, ctx.creds, ctx.acceptEncoding);
  }),

  route("PUT", "channels/:id/retention", async (ctx) => {
    const { days } = await (ctx.body.json() as Promise<{ days?: number | null }>);
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

  route("PUT", "channels/:id/member-permissions", async (ctx) => {
    const { permissions } = await (ctx.body.json() as Promise<{
      permissions?: { is_allowed: boolean; permission: string }[];
    }>);
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

  route("GET", "channels/:id/posting-prefs", async (ctx) => {
    const data = await callSlack("conversations.info", { channel: ctx.params.id }, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.info", ctx.creds, ctx.acceptEncoding);
    }
    const prefs = data.channel?.pref;
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
            : {},
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("PUT", "channels/:id/posting-prefs", async (ctx) => {
    const { prefs } = await (ctx.body.json() as Promise<{
      prefs?: Record<string, string>;
    }>);
    if (!prefs) return errorResponse("invalid_prefs", 400);
    return mutate(
      "conversations.setConversationPrefs",
      { channel: ctx.params.id, prefs: JSON.stringify(prefs) },
      ctx,
    );
  }),

  route("POST", "channels/:id/join", (ctx) =>
    mutateChannel("conversations.join", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "channels/:id/leave", (ctx) =>
    mutate("conversations.leave", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "channels/:id/archive", (ctx) =>
    mutate("conversations.archive", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "channels/:id/unarchive", (ctx) =>
    mutate("conversations.unarchive", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "channels/:id/convert-to-private", (ctx) =>
    mutate("conversations.convertToPrivate", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "channels/:id/close", (ctx) =>
    mutate("conversations.close", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "channels/:id/members", async (ctx) => {
    const { userIds } = await (ctx.body.json() as Promise<{ userIds?: string[] }>);
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
