import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { route } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { HistoryReply } from "../../slack/server/api/slackReplies";
import { hostedChannelId } from "../../slack/server/api/trim/slackChannels";
import { trimMessage } from "../../slack/server/api/trim/slackMessages";

const THREAD_LIMIT = "200";

function annotationTs(annotationId: string): string | null {
  return annotationId.startsWith(TEMP_PREFIX)
    ? `${THREAD_TS_PREFIX}${annotationId.slice(TEMP_PREFIX.length)}`
    : null;
}

const TEMP_PREFIX = "temp:C:";

const THREAD_TS_PREFIX = "Qpc:t:C:";

export const commentRoutes: Route[] = [
  route("GET", "canvases/:id/comments", async (ctx) => {
    const data = await callSlack<HistoryReply>(
      "conversations.history",
      { channel: hostedChannelId(ctx.params.id), limit: THREAD_LIMIT },
      ctx.creds,
    );
    if (!data.ok) {
      if (data.error === "channel_not_found")
        return jsonResponse({ ok: true, threads: [] }, ctx.creds);
      return slackErrorResponse(data, "conversations.history", ctx.creds);
    }
    const threads = (data.messages ?? [])
      .filter((message) => message.document_comment?.thread_id)
      .map(trimMessage);
    return jsonResponse(
      { channelId: hostedChannelId(ctx.params.id), ok: true, threads },
      ctx.creds,
    );
  }),

  route("POST", "canvases/:id/comments/open", async (ctx) => {
    const { annotationId } = await ctx.body.json<{ annotationId?: string }>();
    const ts = annotationId ? annotationTs(annotationId) : null;
    if (!ts) return errorResponse("invalid_annotation", 400);
    const channel = hostedChannelId(ctx.params.id);
    const data = await callSlack<HistoryReply>(
      "conversations.replies",
      { channel, inclusive: "true", limit: "1", ts },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "conversations.replies", ctx.creds);
    const root = data.messages?.[0];
    if (!root) return errorResponse("thread_not_found", 404);
    return jsonResponse({ channelId: channel, ok: true, ts: root.ts }, ctx.creds);
  }),
];
