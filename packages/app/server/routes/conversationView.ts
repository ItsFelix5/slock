// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { jsonResponse, slackErrorResponse } from "../http/jsonResponse.ts";
import { fetchSlack } from "../slackClient.ts";
import { trimChannel, trimMessage, trimUser } from "../trim/slackEntities.ts";
import { type Route, route } from "./router.ts";

// The mounted channel view's initial load: channel metadata, the newest page
// of history, and the users referenced in it, in one round trip. Every flag
// below is fixed — this route is the entire contract, not a passthrough for
// caller-chosen params.
export const conversationViewRoutes: Route[] = [
  route("GET", "/api/channels/:id/view", async (ctx) => {
    const data = await fetchSlack(
      "conversations.view",
      {
        canonical_avatars: "true",
        channel: ctx.params.id,
        count: "28",
        ignore_replies: "true",
        include_free_team_extra_messages: "true",
        include_full_users: "true",
        include_mutation_timestamps: "true",
        include_stories: "true",
        include_use_case: "true",
        no_members: "true",
        no_self: "true",
        no_user_profile: "true",
      },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.view", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(
      {
        channel: trimChannel(data.channel),
        history: {
          has_more: data.history?.has_more,
          messages: Array.isArray(data.history?.messages)
            ? data.history.messages.map(trimMessage)
            : data.history?.messages,
        },
        ok: true,
        users: Array.isArray(data.users) ? data.users.map(trimUser) : data.users,
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
];
