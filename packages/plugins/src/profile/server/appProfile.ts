import { teamIdFromRoute } from "../../slack/server/api/auth";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import { route } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { AppProfileReply } from "../../slack/server/api/slackReplies";

export const appProfileRoutes = [
  route("GET", "apps/:id/profile", async (ctx) => {
    const botId = ctx.searchParams.get("bot");
    if (!botId) return errorResponse("invalid_bot", 400);
    const data = await callSlack<AppProfileReply>(
      "apps.profile.get",
      {
        app: ctx.params.id,
        bot: botId,
        bot_home_team: teamIdFromRoute(ctx.creds?.route ?? "") ?? "",
      },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "apps.profile.get", ctx.creds);
    }
    return jsonResponse({ desc: data.app_profile?.desc, ok: true }, ctx.creds);
  }),
];
