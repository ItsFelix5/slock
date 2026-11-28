import type { Credentials } from "@slock/plugins/slack/server/api/auth";
import {
  errorResponse,
  jsonResponse,
  okResponse,
  slackErrorResponse,
} from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { route } from "@slock/plugins/slack/server/api/router";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import type { HistoryReply } from "@slock/plugins/slack/server/api/slackReplies";
import { trimMessage } from "@slock/plugins/slack/server/api/trim/slackMessages";
import { hostedChannelId, isTs } from "@slock/slack";
import type { ChannelId, RawMessage } from "@slock/types";
import { commentSnippet } from "../protocol/api";
import { lookupThread, notConfigured, openCanvas } from "./api";
import type { CanvasWire } from "./wire";

const PAGE_SIZE = "200";
const MAX_PAGES = 10;
const ANNOTATION_PREFIX = "temp:C:";
const THREAD_TS_PREFIX = "Qpc:t:C:";

function annotationTs(annotationId: string): string | null {
  return annotationId.startsWith(ANNOTATION_PREFIX)
    ? `${THREAD_TS_PREFIX}${annotationId.slice(ANNOTATION_PREFIX.length)}`
    : null;
}

async function threadRoots(channel: ChannelId, creds: Credentials | null) {
  const roots: RawMessage[] = [];
  let cursor = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await callSlack<HistoryReply>(
      "conversations.history",
      { channel, limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
      creds,
    );
    if (!data.ok) return data;
    roots.push(...(data.messages ?? []).filter((message) => message.document_comment?.thread_id));
    cursor = data.response_metadata?.next_cursor ?? "";
    if (!cursor) break;
  }
  return { ok: true as const, roots };
}

export const commentRoutes = (wire: CanvasWire): Route[] => [
  route("GET", "canvases/:id/comments", async (ctx) => {
    const data = await threadRoots(hostedChannelId(ctx.params.id), ctx.creds);
    if (!data.ok) {
      if (data.error === "channel_not_found") return jsonResponse({ ok: true, threads: [] });
      return slackErrorResponse(data, "conversations.history");
    }
    return jsonResponse({ ok: true, threads: data.roots.map(trimMessage) });
  }),

  route("POST", "canvases/:id/comments/open", async (ctx) => {
    if (!ctx.creds) return notConfigured();
    const { annotationId = "" } = await ctx.body.json<{ annotationId?: string }>();
    const ts = annotationTs(annotationId);
    if (!ts) return errorResponse("invalid_annotation", 400);
    const hint = ctx.searchParams.get("thread");
    const canvas = await openCanvas(wire, ctx.params.id, hint, ctx.creds);
    if ("response" in canvas) return canvas.response;
    if (canvas.access === "view") return errorResponse("not_allowed", 403);
    if (!canvas.raw.ok) return errorResponse(canvas.raw.error, 502);
    const snippet = commentSnippet(canvas.raw.bytes, annotationId, ctx.creds.domain);
    const data = await callSlack<HistoryReply>(
      "conversations.replies",
      {
        channel: hostedChannelId(ctx.params.id),
        inclusive: "true",
        limit: "1",
        ts,
        ...(snippet ? { content_snippet: JSON.stringify(snippet) } : {}),
      },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "conversations.replies");
    const root = data.messages?.[0];
    if (!root) return errorResponse("thread_not_found", 404);
    return jsonResponse({ ok: true, ts: root.ts });
  }),

  route("POST", "canvases/:id/comments/sync", async (ctx) => {
    const { ts = "" } = await ctx.body.json<{ ts?: string }>();
    if (!isTs(ts)) return errorResponse("invalid_ts", 400);
    const data = await callSlack(
      "quip.thread.synchronize",
      { channel_id: hostedChannelId(ctx.params.id), thread_ts: ts },
      ctx.creds,
    );
    // Grid refuses this for workspace tokens, and the reply it follows is already posted.
    if (!data.ok && data.error !== "team_is_restricted")
      return slackErrorResponse(data, "quip.thread.synchronize");
    return okResponse();
  }),

  route("POST", "canvases/:id/comments/resolve", async (ctx) => {
    if (!ctx.creds) return notConfigured();
    const { resolved, ts = "" } = await ctx.body.json<{ resolved?: boolean; ts?: string }>();
    if (!isTs(ts)) return errorResponse("invalid_ts", 400);
    const lookup = await lookupThread(ctx.params.id, ctx.creds);
    if ("response" in lookup) return lookup.response;
    if (lookup.access === "view") return errorResponse("not_allowed", 403);
    const method = resolved ? "quip.thread.archive" : "quip.thread.unarchive";
    const data = await callSlack(
      method,
      { channel_id: hostedChannelId(ctx.params.id), thread_ts: ts },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, method);
    return okResponse();
  }),
];
