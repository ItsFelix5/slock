import { jsonResponse, slackErrorResponse } from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { route } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { TeamProfileReply } from "../../slack/server/api/slackReplies";

export const fieldRoutes: Route[] = [
  route("GET", "profile-fields", async (ctx) => {
    const data = await callSlack<TeamProfileReply>("team.profile.get", {}, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "team.profile.get", ctx.creds);
    }
    return jsonResponse(
      {
        fields: (data.profile?.fields ?? [])
          .filter((f) => !f.is_hidden)
          .sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0))
          .map((f) => ({ fieldName: f.field_name, id: f.id, label: f.label, type: f.type })),
        ok: true,
      },
      ctx.creds,
    );
  }),
];
