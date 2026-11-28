import { fetchAppProfile } from "@slock/plugins/slack/server/api/appProfile";
import { jsonResponse, slackErrorResponse } from "@slock/plugins/slack/server/api/jsonResponse";
import { route } from "@slock/plugins/slack/server/api/router";

export const appProfileRoutes = [
  route("GET", "apps/:id/profile", async (ctx) => {
    const data = await fetchAppProfile(
      ctx.params.id,
      ctx.creds,
      ctx.searchParams.get("bot") ?? undefined,
    );
    if (!data.ok) return slackErrorResponse(data, "apps.profile.get");
    const { app_user_id, desc } = data.app_profile ?? {};
    return jsonResponse({ desc, ok: true, userId: app_user_id });
  }),
];
