import { jsonResponse, slackErrorResponse } from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { route } from "@slock/plugins/slack/server/api/router";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import type { TeamProfileReply } from "@slock/plugins/slack/server/api/slackReplies";

export const fieldRoutes: Route[] = [
  route("GET", "profile-fields", async (ctx) => {
    const data = await callSlack<TeamProfileReply>("team.profile.get", {}, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "team.profile.get");
    }
    return jsonResponse({
      fields: (data.profile?.fields ?? [])
        .filter((f) => !f.is_hidden)
        .sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0))
        .map((f) => ({ fieldName: f.field_name, id: f.id, label: f.label, type: f.type })),
      ok: true,
    });
  }),
];
