import type { Setup } from "@slock/core";
import type { MessageShortcut } from "@slock/types";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { AppCommandsReply } from "../../slack/server/api/slackReplies";

const list: Route[] = [
  route("GET", "message-shortcuts", async (ctx) => {
    const data = await callSlack<AppCommandsReply>("client.appCommands", {}, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "client.appCommands", ctx.creds);
    }
    const shortcuts: MessageShortcut[] = [];
    for (const app of data.app_actions ?? []) {
      const icon =
        app.icons?.image_48 ?? app.icons?.image_72 ?? app.icons?.image_32 ?? app.icons?.image_64;
      for (const action of app.actions ?? []) {
        if (action.type !== "message_action" || !action.action_id || !action.name) continue;
        if (!(app.app_id && app.app_name)) continue;
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
    return jsonResponse({ ok: true, shortcuts }, ctx.creds);
  }),

  route("POST", "message-shortcuts/:actionId/run", async (ctx) => {
    const { appId, channelId, messageTs } = await ctx.body.json<{
      appId?: string;
      channelId?: string;
      messageTs?: string;
    }>();
    if (!(appId && channelId && messageTs)) return errorResponse("invalid_shortcut_run", 400);
    return mutate(
      "apps.actions.v2.execute",
      {
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
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
