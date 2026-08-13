import { teamIdFromRoute } from "../../auth.ts";
import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import { mutate, type Route, route } from "../router.ts";

export const appRoutes: Route[] = [
  route("GET", "/api/message-shortcuts", async (ctx) => {
    const data = await callSlack(
      "client.appCommands",
      { _x_reason: "app-commands-conditional-fetching" },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "client.appCommands", ctx.creds, ctx.acceptEncoding);
    }
    const apps: any[] = Array.isArray(data.app_actions) ? data.app_actions : [];
    const shortcuts: any[] = [];
    for (const app of apps) {
      const icon =
        app.icons?.image_48 ?? app.icons?.image_72 ?? app.icons?.image_32 ?? app.icons?.image_64;
      for (const action of app.actions ?? []) {
        if (action.type !== "message_action") continue;
        shortcuts.push({
          actionId: action.action_id,
          appId: app.app_id,
          appName: app.app_name,
          description: action.description ?? action.desc,
          icon,
          name: action.name,
        });
      }
    }
    return jsonResponse({ ok: true, shortcuts }, ctx.creds, ctx.acceptEncoding);
  }),

  route("POST", "/api/message-shortcuts/:actionId/run", async (ctx) => {
    const { appId, channelId, messageTs } = (await ctx.body.json()) as {
      appId?: string;
      channelId?: string;
      messageTs?: string;
    };
    if (!(appId && channelId && messageTs)) return errorResponse("invalid_shortcut_run", 400);
    return mutate(
      "apps.actions.v2.execute",
      {
        _x_reason: "message-shortcuts-menu",
        action_id: ctx.params.actionId,
        app_id: appId,
        client_token: `web-${Date.now()}`,
        context: JSON.stringify({
          channel_id: channelId,
          message_ts: messageTs,
        }),
      },
      ctx,
    );
  }),

  route("GET", "/api/apps/:id/profile", async (ctx) => {
    const botId = ctx.searchParams.get("bot");
    if (!botId) return errorResponse("invalid_bot", 400);
    const data = await callSlack(
      "apps.profile.get",
      {
        app: ctx.params.id,
        bot: botId,
        bot_home_team: teamIdFromRoute(ctx.creds?.route ?? "") ?? "",
      },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "apps.profile.get", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse({ desc: data.app_profile?.desc, ok: true }, ctx.creds, ctx.acceptEncoding);
  }),

  route("POST", "/api/blocks/actions", async (ctx) => {
    const body = (await ctx.body.json()) as {
      action?: Record<string, unknown>;
      appId?: string;
      botId?: string;
      channelId?: string;
      messageTs?: string;
    };
    if (!(body.action && body.appId && body.botId && body.channelId && body.messageTs)) {
      return errorResponse("invalid_block_action", 400);
    }
    return mutate(
      "blocks.actions",
      {
        actions: JSON.stringify([body.action]),
        app_id: body.appId,
        client_token: `web-${Date.now()}`,
        container: JSON.stringify({
          channel_id: body.channelId,
          is_ephemeral: false,
          message_ts: body.messageTs,
          type: "message",
        }),
        service_id: body.botId,
        service_team_id: teamIdFromRoute(ctx.creds?.route ?? "") ?? "",
        state: JSON.stringify({ values: {} }),
      },
      ctx,
    );
  }),

  route("POST", "/api/attachments/actions", async (ctx) => {
    const body = (await ctx.body.json()) as {
      action?: { name?: string; style?: string; text?: string; value?: string };
      attachmentId?: number;
      botId?: string;
      botUserId?: string;
      callbackId?: string;
      channelId?: string;
      isEphemeral?: boolean;
      messageTs?: string;
    };
    if (
      !(
        body.action?.name &&
        body.action.text &&
        body.attachmentId !== undefined &&
        body.botId &&
        body.botUserId &&
        body.callbackId &&
        body.channelId &&
        body.messageTs
      )
    ) {
      return errorResponse("invalid_attachment_action", 400);
    }
    const attachmentId = String(body.attachmentId);
    return mutate(
      "chat.attachmentAction",
      {
        bot_user_id: body.botUserId,
        client_token: `web-${Date.now()}`,
        payload: JSON.stringify({
          actions: [
            {
              id: attachmentId,
              name: body.action.name,
              style: body.action.style ?? "",
              text: body.action.text,
              type: "button",
              ...(body.action.value === undefined ? {} : { value: body.action.value }),
            },
          ],
          attachment_id: attachmentId,
          callback_id: body.callbackId,
          channel_id: body.channelId,
          is_ephemeral: body.isEphemeral ?? false,
          message_ts: body.messageTs,
          prompt_app_install: false,
        }),
        service_id: body.botId,
      },
      ctx,
    );
  }),
];
