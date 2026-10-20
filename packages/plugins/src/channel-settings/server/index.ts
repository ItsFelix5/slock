import type { Setup } from "@slock/core";
import {
  fetchChannelManagerAssignments,
  managerIdsFromAssignments,
} from "../../slack/server/api/channelManagers";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route, RouteCtx } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type {
  ChannelInfoReply,
  MemberPermissionsReply,
  RetentionReply,
} from "../../slack/server/api/slackReplies";

function okNoop(ctx: RouteCtx): Response {
  return jsonResponse({ ok: true }, ctx.creds);
}

const list: Route[] = [
  route("PUT", "channels/:id/purpose", async (ctx) => {
    const { purpose } = await ctx.body.json<{ purpose?: string }>();
    if (purpose === undefined) return errorResponse("invalid_purpose", 400);
    return mutate("conversations.setPurpose", { channel: ctx.params.id, purpose }, ctx);
  }),

  route("PUT", "channels/:id/topic", async (ctx) => {
    const { topic } = await ctx.body.json<{ topic?: string }>();
    if (topic === undefined) return errorResponse("invalid_topic", 400);
    return mutate("conversations.setTopic", { channel: ctx.params.id, topic }, ctx);
  }),

  route("GET", "channels/:id/retention", async (ctx) => {
    const data = await callSlack<RetentionReply>(
      "conversations.getRetention",
      { channel: ctx.params.id },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.getRetention", ctx.creds);
    }
    const days = data.retention_type === "1" ? Number(data.retention_duration) || null : null;
    return jsonResponse({ days, ok: true }, ctx.creds);
  }),

  route("PUT", "channels/:id/retention", async (ctx) => {
    const { days } = await ctx.body.json<{ days?: number | null }>();
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

  route("GET", "channels/:id/member-permissions", async (ctx) => {
    const data = await callSlack<MemberPermissionsReply>(
      "conversations.permissions.accountTypes.list",
      { channel_id: ctx.params.id },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.permissions.accountTypes.list", ctx.creds);
    }
    const member = data.account_types?.find((type) => type.account_type === "FULL_MEMBER");
    const allowed = (permission: string) =>
      member?.permissions.find((entry) => entry.permission === permission)?.is_allowed ?? true;
    return jsonResponse(
      {
        invite: allowed("INVITE_TO_CHANNEL"),
        ok: true,
        setPurpose: allowed("SET_CHANNEL_PURPOSE"),
        setTopic: allowed("SET_CHANNEL_TOPIC"),
      },
      ctx.creds,
    );
  }),

  route("PUT", "channels/:id/member-permissions", async (ctx) => {
    const { permissions } = await ctx.body.json<{
      permissions?: { is_allowed: boolean; permission: string }[];
    }>();
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
    const data = await callSlack<ChannelInfoReply>(
      "conversations.info",
      { channel: ctx.params.id },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.info", ctx.creds);
    }
    const { pref } = data.channel;
    return jsonResponse(
      {
        ok: true,
        prefs: pref
          ? {
              can_thread: pref.can_thread,
              enable_at_channel: pref.enable_at_channel,
              enable_at_here: pref.enable_at_here,
              who_can_post: pref.who_can_post,
            }
          : {},
      },
      ctx.creds,
    );
  }),

  route("PUT", "channels/:id/posting-prefs", async (ctx) => {
    const { prefs } = await ctx.body.json<{
      prefs?: Record<string, string>;
    }>();
    if (!prefs) return errorResponse("invalid_prefs", 400);
    return mutate(
      "conversations.setConversationPrefs",
      { channel: ctx.params.id, prefs: JSON.stringify(prefs) },
      ctx,
    );
  }),

  route("POST", "channels/:id/archive", (ctx) =>
    mutate("conversations.archive", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "channels/:id/unarchive", (ctx) =>
    mutate("conversations.unarchive", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "channels/:id/convert-to-private", (ctx) =>
    mutate("conversations.convertToPrivate", { channel: ctx.params.id }, ctx),
  ),

  route("GET", "channels/:id/managers", async (ctx) => {
    const data = await fetchChannelManagerAssignments(ctx.params.id, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "admin.roles.entity.listAssignments", ctx.creds);
    }
    return jsonResponse(
      {
        ok: true,
        userIds: managerIdsFromAssignments(data),
      },
      ctx.creds,
    );
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
