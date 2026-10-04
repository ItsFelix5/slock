import { jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import type { ConversationViewReply } from "../../slackReplies.ts";
import { trimChannel } from "../../trim/slackChannels.ts";
import { trimUser } from "../../trim/slackEntities.ts";
import { trimMessage } from "../../trim/slackMessages.ts";
import { type Route, route } from "../router.ts";

export const conversationViewRoutes: Route[] = [
  route("GET", "channels/:id/view", async (ctx) => {
    const data = await callSlack<ConversationViewReply>(
      "conversations.view",
      {
        canonical_avatars: "true",
        channel: ctx.params.id,
        count: "30",
        ignore_replies: "true",
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
    if (!data.ok)
      return slackErrorResponse(data, "conversations.view", ctx.creds, ctx.acceptEncoding);
    return jsonResponse(
      {
        channel: data.channel && trimChannel(data.channel),
        history: {
          has_more: data.history?.has_more,
          messages: data.history?.messages?.map(trimMessage),
        },
        ok: true,
        users: data.users?.map(trimUser),
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
];
