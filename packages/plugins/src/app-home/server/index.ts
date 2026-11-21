import type { Setup } from "@slock/core";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "@slock/plugins/slack/server/api/jsonResponse";
import { mutate, route, routes } from "@slock/plugins/slack/server/api/router";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";

type AppHomeReply = {
  app_home?: {
    app_id: string;
    home_tab_enabled: boolean;
    messages_tab_enabled: boolean;
  };
  home_view?: unknown;
};

type AppProfileReply = { app_profile: { team_id: string } };

const setup: Setup = (ctx) => {
  ctx.add(
    "http",
    routes([
      route("GET", "conversations/:id/app-home", async (request) => {
        const data = await callSlack<AppHomeReply>(
          "conversations.info",
          { channel: request.params.id, return_app_home: "true" },
          request.creds,
        );
        if (!data.ok) return slackErrorResponse(data, "conversations.info");
        return jsonResponse({ appHome: data.app_home ?? null, view: data.home_view });
      }),
      route("POST", "conversations/:id/app-home/open", async (request) => {
        const { appId } = await request.body.json<{ appId?: string }>();
        if (!appId) return errorResponse("invalid_app", 400);
        const profile = await callSlack<AppProfileReply>(
          "apps.profile.get",
          { app: appId },
          request.creds,
        );
        if (!profile.ok) return slackErrorResponse(profile, "apps.profile.get");
        return mutate(
          "apps.home.dispatchOpenEvent",
          { id: request.params.id, service_team_id: profile.app_profile.team_id, type: "home" },
          request,
        );
      }),
    ]),
  );
};

export default setup;
