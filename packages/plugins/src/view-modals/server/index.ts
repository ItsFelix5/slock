import type { Setup } from "@slock/core";
import { service } from "@slock/core/services";
import { type Credentials, teamIdFromRoute } from "@slock/plugins/slack/server/api/auth";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { mutate, route, routes } from "@slock/plugins/slack/server/api/router";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import { isChannelId, isTs } from "@slock/slack";
import type { ChannelId, Ts } from "@slock/types";

type SubmitReply = {
  errors?: Record<string, string>;
  response_action?: string;
  toast_message?: string;
  view?: unknown;
};

const env = service("env");

function serviceTeamId(botTeamId: string | undefined, creds: Credentials | null | undefined) {
  return botTeamId ?? teamIdFromRoute(creds?.route ?? "");
}

const list: Route[] = [
  route("POST", "blocks/actions", async (ctx) => {
    const body = await ctx.body.json<{
      action?: Record<string, unknown>;
      botId?: string;
      botTeamId?: string;
      container?: Record<string, unknown>;
      state?: unknown;
    }>();
    if (!(body.action && body.botId && body.container)) {
      return errorResponse("invalid_block_action", 400);
    }
    return mutate(
      "blocks.actions",
      {
        actions: JSON.stringify([body.action]),
        client_token: `web-${env.now()}`,
        container: JSON.stringify(body.container),
        service_id: body.botId,
        service_team_id: serviceTeamId(body.botTeamId, ctx.creds),
        state: JSON.stringify(body.state ?? { values: {} }),
      },
      ctx,
    );
  }),

  route("POST", "blocks/suggestions", async (ctx) => {
    const body = await ctx.body.json<{
      actionId?: string;
      blockId?: string;
      botId?: string;
      botTeamId?: string;
      container?: Record<string, unknown>;
      value?: string;
    }>();
    if (!(body.actionId && body.botId && body.container)) {
      return errorResponse("invalid_block_suggestion", 400);
    }
    const data = await callSlack<{ option_groups?: unknown[]; options?: unknown[] }>(
      "blocks.suggestions",
      {
        action_id: body.actionId,
        block_id: body.blockId ?? "",
        container: JSON.stringify(body.container),
        service_id: body.botId,
        service_team_id: serviceTeamId(body.botTeamId, ctx.creds),
        value: body.value ?? "",
      },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "blocks.suggestions");
    return jsonResponse({ option_groups: data.option_groups, options: data.options });
  }),

  route("POST", "views/submit", async (ctx) => {
    const body = await ctx.body.json<{ state?: unknown; viewId?: string }>();
    if (!body.viewId) return errorResponse("invalid_view_submit", 400);
    const data = await callSlack<SubmitReply>(
      "views.submit",
      {
        client_token: `web-${env.now()}`,
        state: JSON.stringify(body.state ?? { values: {} }),
        view_id: body.viewId,
      },
      ctx.creds,
    );
    if (!data.ok) return errorResponse(data.error, 502, data);
    return jsonResponse({
      errors: data.errors,
      response_action: data.response_action,
      toast_message: data.toast_message,
      view: data.view,
    });
  }),

  route("POST", "views/close", async (ctx) => {
    const body = await ctx.body.json<{ rootViewId?: string; viewId?: string }>();
    if (!body.viewId) return errorResponse("invalid_view_close", 400);
    return mutate(
      "views.close",
      {
        client_token: `web-${env.now()}`,
        ...(body.rootViewId ? { root_view_id: body.rootViewId } : {}),
        view_id: body.viewId,
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
      channelId?: ChannelId;
      isEphemeral?: boolean;
      messageTs?: Ts;
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
        isChannelId(body.channelId) &&
        body.messageTs &&
        isTs(body.messageTs)
      )
    ) {
      return errorResponse("invalid_attachment_action", 400);
    }
    const attachmentId = String(body.attachmentId);
    return mutate(
      "chat.attachmentAction",
      {
        bot_user_id: body.botUserId,
        client_token: `web-${env.now()}`,
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
