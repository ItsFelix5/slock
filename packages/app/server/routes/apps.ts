// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { teamIdFromRoute } from "../auth.ts";
import { errorResponse, jsonResponse, slackErrorResponse } from "../http/jsonResponse.ts";
import { fetchSlack } from "../slackClient.ts";
import { mutate, type Route, route } from "./router.ts";

export const appRoutes: Route[] = [
  // client.appCommands' `app_actions` list mixes every action any installed
  // app registered — global shortcuts and per-message shortcuts share this
  // one list, distinguished only by `type`; we only care about "message_action".
  route("GET", "/api/message-shortcuts", async (ctx) => {
    const data = await fetchSlack(
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

  // Fire-and-forget: the app receives the message via its own interactivity
  // endpoint and responds asynchronously, not through this call's result.
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
        context: JSON.stringify({ channel_id: channelId, message_ts: messageTs }),
      },
      ctx,
    );
  }),

  // Powers the app "About" flyout Slack's own client shows for a bot user.
  // Reverse-engineered from a live capture: keyed by the app id, the bot's
  // classic id, and the bot's home team (not necessarily this workspace's own
  // team id on Enterprise Grid) - derived here from the route cookie instead
  // of the browser needing to know or send it.
  route("GET", "/api/apps/:id/profile", async (ctx) => {
    const botId = ctx.searchParams.get("bot");
    if (!botId) return errorResponse("invalid_bot", 400);
    const data = await fetchSlack(
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

  // Dispatches a Block Kit button click. Reverse-engineered from a live
  // capture of Slack's own web client: actions carries the modern
  // block_actions shape, container identifies the message the block lives
  // in. Fire-and-forget, like the shortcut run above.
  route("POST", "/api/blocks/actions", async (ctx) => {
    const body = (await ctx.body.json()) as {
      actionId?: string;
      appId?: string;
      blockId?: string;
      botId?: string;
      buttonText?: string;
      channelId?: string;
      messageTs?: string;
      value?: string;
    };
    if (
      !(
        body.actionId &&
        body.appId &&
        body.botId &&
        body.buttonText &&
        body.channelId &&
        body.messageTs
      )
    ) {
      return errorResponse("invalid_block_action", 400);
    }
    return mutate(
      "blocks.actions",
      {
        actions: JSON.stringify([
          {
            action_id: body.actionId,
            block_id: body.blockId,
            text: { emoji: true, text: body.buttonText, type: "plain_text" },
            type: "button",
            value: body.value ?? "",
          },
        ]),
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
];
