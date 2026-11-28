import type { Setup } from "@slock/core";
import { fetchAppProfile } from "@slock/plugins/slack/server/api/appProfile";
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
        const profile = await fetchAppProfile(appId, request.creds);
        if (!profile.ok) return slackErrorResponse(profile, "apps.profile.get");
        const teamId = profile.app_profile?.team_id;
        if (!teamId) return errorResponse("invalid_app", 400);
        return mutate(
          "apps.home.dispatchOpenEvent",
          { id: request.params.id, service_team_id: teamId, type: "home" },
          request,
        );
      }),
    ]),
  );
};

export default setup;
