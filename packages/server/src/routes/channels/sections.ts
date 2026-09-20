import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import { trimChannelSections } from "../../trim/slackEntities.ts";
import { mutate, type Route, route } from "../router.ts";

export const sectionRoutes: Route[] = [
  route("GET", "sections", async (ctx) => {
    const data = await callSlack("users.channelSections.list", {}, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "users.channelSections.list", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(trimChannelSections(data), ctx.creds, ctx.acceptEncoding);
  }),

  route("POST", "sections", async (ctx) => {
    const { name } = await (ctx.body.json() as Promise<{ name?: string }>);
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

  route("PATCH", "sections/:id", async (ctx) => {
    const { name } = await (ctx.body.json() as Promise<{ name?: string }>);
    if (!name) return errorResponse("invalid_patch", 400);
    return mutate("users.channelSections.set", { channel_section_id: ctx.params.id, name }, ctx);
  }),

  route("DELETE", "sections/:id", (ctx) =>
    mutate("users.channelSections.delete", { channel_section_id: ctx.params.id }, ctx),
  ),

  route("PUT", "sections/:id/order", async (ctx) => {
    const { nextSectionId } = await (ctx.body.json() as Promise<{
      nextSectionId?: string | null;
    }>);
    return mutate(
      "users.channelSections.set",
      {
        channel_section_id: ctx.params.id,
        ...(nextSectionId ? { next_channel_section_id: nextSectionId } : {}),
      },
      ctx,
    );
  }),

  route("PUT", "sections/:id/channels", async (ctx) => {
    const { insertChannelIds, removeChannelIds } = await (ctx.body.json() as Promise<{
      insertChannelIds?: string[];
      removeChannelIds?: string[];
    }>);
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

  route("PUT", "channels/:id/notifications", async (ctx) => {
    const { target, value } = await (ctx.body.json() as Promise<{
      target?: "desktop" | "mobile";
      value?: string;
    }>);
    if (!(target && value)) return errorResponse("invalid_notification_target", 400);
    return mutate(
      "users.prefs.setNotifications",
      { channel_id: ctx.params.id, global: "false", name: target, value },
      ctx,
    );
  }),

  route("POST", "dms", async (ctx) => {
    const { userId } = await (ctx.body.json() as Promise<{ userId?: string }>);
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
