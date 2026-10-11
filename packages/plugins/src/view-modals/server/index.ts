import type { Setup } from "@slock/core";
import { teamIdFromRoute } from "../../slack/server/api/auth";
import { errorResponse } from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";

const list: Route[] = [
  route("POST", "blocks/actions", async (ctx) => {
    const body = await ctx.body.json<{
      action?: Record<string, unknown>;
      appId?: string;
      botId?: string;
      channelId?: string;
      messageTs?: string;
    }>();
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

  route("POST", "attachments/actions", async (ctx) => {
    const body = await ctx.body.json<{
      action?: { name?: string; style?: string; text?: string; value?: string };
      attachmentId?: number;
      botId?: string;
      botUserId?: string;
      callbackId?: string;
      channelId?: string;
      isEphemeral?: boolean;
      messageTs?: string;
    }>();
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

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
