import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import { trimChannelSections } from "../../trim/slackEntities.ts";
import { mutate, type Route, route } from "../router.ts";

export const sectionRoutes: Route[] = [
  route("GET", "/api/sections", async (ctx) => {
    const data = await callSlack("users.channelSections.list", {}, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "users.channelSections.list", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(trimChannelSections(data), ctx.creds, ctx.acceptEncoding);
  }),

  route("POST", "/api/sections", async (ctx) => {
    const { name } = (await ctx.body.json()) as { name?: string };
    if (!name) return errorResponse("invalid_name", 400);
    const data = await callSlack(
      "users.channelSections.create",
      { emoji: "", name, type: "standard" },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(
        data,
        "users.channelSections.create",
        ctx.creds,
        ctx.acceptEncoding,
      );
    }
    const section = data.channel_section ?? data;
    return jsonResponse(
      {
        channel_section: {
          channel_section_id: section.channel_section_id,
          id: section.id,
          name: section.name,
        },
        ok: true,
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("PATCH", "/api/sections/:id", async (ctx) => {
    const body = (await ctx.body.json()) as {
      name?: string;
      sidebar?: "hid" | "active" | "all";
    };
    if (body.name === undefined && body.sidebar === undefined) {
      return errorResponse("invalid_patch", 400);
    }
    const params: Record<string, string> = {
      channel_section_id: ctx.params.id,
    };
    if (body.name !== undefined) params.name = body.name;
    if (body.sidebar !== undefined) params.sidebar = body.sidebar;
    return mutate("users.channelSections.update", params, ctx);
  }),

  route("DELETE", "/api/sections/:id", (ctx) =>
    mutate("users.channelSections.delete", { channel_section_id: ctx.params.id }, ctx),
  ),

  route("PUT", "/api/sections/:id/order", async (ctx) => {
    const { nextSectionId } = (await ctx.body.json()) as {
      nextSectionId?: string | null;
    };
    return mutate(
      "users.channelSections.set",
      {
        channel_section_id: ctx.params.id,
        ...(nextSectionId ? { next_channel_section_id: nextSectionId } : {}),
      },
      ctx,
    );
  }),

  route("PUT", "/api/sections/:id/channels", async (ctx) => {
    const { insertChannelIds, removeChannelIds } = (await ctx.body.json()) as {
      insertChannelIds?: string[];
      removeChannelIds?: string[];
    };
    const insert = insertChannelIds?.length
      ? [{ channel_ids: insertChannelIds, channel_section_id: ctx.params.id }]
      : [];
    const remove = removeChannelIds?.length
      ? [{ channel_ids: removeChannelIds, channel_section_id: ctx.params.id }]
      : [];
    return mutate(
      "users.channelSections.channels.bulkUpdate",
      {
        _x_reason: "channel-sidebar-channel-drop",
        insert: JSON.stringify(insert),
        remove: JSON.stringify(remove),
      },
      ctx,
    );
  }),

  route("PUT", "/api/channels/:id/notifications", async (ctx) => {
    const { target, value } = (await ctx.body.json()) as {
      target?: "desktop" | "mobile";
      value?: string;
    };
    if (!(target && value)) return errorResponse("invalid_notification_target", 400);
    return mutate(
      "users.prefs.setNotifications",
      { channel_id: ctx.params.id, global: "false", name: target, value },
      ctx,
    );
  }),

  route("POST", "/api/dms", async (ctx) => {
    const { userId } = (await ctx.body.json()) as { userId?: string };
    if (!userId) return errorResponse("invalid_user_id", 400);
    const data = await callSlack("conversations.open", { users: userId }, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.open", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(
      { channel: { id: data.channel?.id }, ok: true },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
];
