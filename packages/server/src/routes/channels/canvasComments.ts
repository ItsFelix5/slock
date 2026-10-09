import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import type { HistoryReply } from "../../slackReplies.ts";
import { hostedChannelId } from "../../trim/slackChannels.ts";
import { trimMessage } from "../../trim/slackMessages.ts";
import { type Route, route } from "../router.ts";

const TEMP_PREFIX = "temp:C:";
const THREAD_TS_PREFIX = "Qpc:t:C:";
const THREAD_LIMIT = "200";

function annotationTs(annotationId: string): string | null {
  return annotationId.startsWith(TEMP_PREFIX)
    ? `${THREAD_TS_PREFIX}${annotationId.slice(TEMP_PREFIX.length)}`
    : null;
}

export const canvasCommentRoutes: Route[] = [
  route("GET", "canvases/:id/comments", async (ctx) => {
    const data = await callSlack<HistoryReply>(
      "conversations.history",
      { channel: hostedChannelId(ctx.params.id), limit: THREAD_LIMIT },
      ctx.creds,
    );
    if (!data.ok) {
      if (data.error === "channel_not_found")
        return jsonResponse({ ok: true, threads: [] }, ctx.creds, ctx.acceptEncoding);
      return slackErrorResponse(data, "conversations.history", ctx.creds, ctx.acceptEncoding);
    }
    const threads = (data.messages ?? [])
      .filter((message) => message.document_comment?.thread_id)
      .map(trimMessage);
    return jsonResponse(
      { channelId: hostedChannelId(ctx.params.id), ok: true, threads },
      ctx.creds,
      ctx.acceptEncoding,
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
    if (!data.ok)
      return slackErrorResponse(data, "conversations.replies", ctx.creds, ctx.acceptEncoding);
    const root = data.messages?.[0];
    if (!root) return errorResponse("thread_not_found", 404);
    return jsonResponse(
      { channelId: channel, ok: true, ts: root.ts },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
];
