import type { Setup } from "@slock/core";
import { teamIdFromRoute } from "../../slack/server/api/auth";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";

type SubmitReply = {
  errors?: Record<string, string>;
  response_action?: string;
  toast_message?: string;
  view?: unknown;
};

const list: Route[] = [
  route("POST", "blocks/actions", async (ctx) => {
    const body = await ctx.body.json<{
      action?: Record<string, unknown>;
      appId?: string;
      botId?: string;
      container?: Record<string, unknown>;
      state?: unknown;
    }>();
    if (!(body.action && body.appId && body.botId && body.container)) {
      return errorResponse("invalid_block_action", 400);
    }
    return mutate(
      "blocks.actions",
      {
        actions: JSON.stringify([body.action]),
        app_id: body.appId,
        client_token: `web-${Date.now()}`,
        container: JSON.stringify(body.container),
        service_id: body.botId,
        service_team_id: teamIdFromRoute(ctx.creds?.route ?? "") ?? "",
        state: JSON.stringify(body.state ?? { values: {} }),
      },
      ctx,
    );
  }),

  route("POST", "blocks/suggestions", async (ctx) => {
    const body = await ctx.body.json<{
      actionId?: string;
      appId?: string;
      blockId?: string;
      botId?: string;
      container?: Record<string, unknown>;
      value?: string;
    }>();
    if (!(body.actionId && body.appId && body.botId && body.container)) {
      return errorResponse("invalid_block_suggestion", 400);
    }
    const data = await callSlack<{ option_groups?: unknown[]; options?: unknown[] }>(
      "blocks.suggestions",
      {
        action_id: body.actionId,
        app_id: body.appId,
        block_id: body.blockId ?? "",
        container: JSON.stringify(body.container),
        service_id: body.botId,
        service_team_id: teamIdFromRoute(ctx.creds?.route ?? "") ?? "",
        value: body.value ?? "",
      },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "blocks.suggestions", ctx.creds);
    return jsonResponse({ option_groups: data.option_groups, options: data.options }, ctx.creds);
  }),

  route("POST", "views/submit", async (ctx) => {
    const body = await ctx.body.json<{ state?: unknown; viewId?: string }>();
    if (!body.viewId) return errorResponse("invalid_view_submit", 400);
    const data = await callSlack<SubmitReply>(
      "views.submit",
      {
        client_token: `web-${Date.now()}`,
        state: JSON.stringify(body.state ?? { values: {} }),
        view_id: body.viewId,
      },
      ctx.creds,
    );
    if (!data.ok) return errorResponse(data.error, 502, data);
    return jsonResponse(
      {
        errors: data.errors,
        response_action: data.response_action,
        toast_message: data.toast_message,
        view: data.view,
      },
      ctx.creds,
    );
  }),

  route("POST", "views/close", async (ctx) => {
    const body = await ctx.body.json<{ rootViewId?: string; viewId?: string }>();
    if (!body.viewId) return errorResponse("invalid_view_close", 400);
    return mutate(
      "views.close",
      {
        client_token: `web-${Date.now()}`,
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
