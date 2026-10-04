import { parseCanvasEdit } from "@slock/types";
import type { Credentials } from "../../auth.ts";
import { applyCanvasEdit } from "../../canvasEdit.ts";
import { fetchCanvasRaw } from "../../canvasRaw.ts";
import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import type { FileInfoReply } from "../../slackReplies.ts";
import { trimFile } from "../../trim/slackMessages.ts";
import { type Route, type RouteCtx, route } from "../router.ts";

type ThreadLookup = { response: Response } | { editable: boolean; threadId: string };

async function lookupThread(ctx: RouteCtx, creds: Credentials): Promise<ThreadLookup> {
  const data = await callSlack<FileInfoReply>("files.info", { file: ctx.params.id }, creds);
  if (!data.ok) {
    return { response: slackErrorResponse(data, "files.info", creds, ctx.acceptEncoding) };
  }
  const threadId = data.file.quip_thread_id;
  if (!threadId) {
    console.error(
      `[canvas] no quip_thread_id on file ${ctx.params.id}, file keys:`,
      Object.keys(data.file),
    );
    return {
      response: jsonResponse(
        { error: "canvas has no quip_thread_id" },
        creds,
        ctx.acceptEncoding,
        502,
      ),
    };
  }
  return { editable: data.file.editable !== false, threadId };
}

function notConfigured(ctx: RouteCtx): Response {
  return slackErrorResponse({ error: "not_configured" }, "files.info", null, ctx.acceptEncoding);
}

export const canvasRoutes: Route[] = [
  route("GET", "canvases/:id/file-info", async (ctx) => {
    const data = await callSlack<FileInfoReply>("files.info", { file: ctx.params.id }, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "files.info", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse({ file: trimFile(data.file), ok: true }, ctx.creds, ctx.acceptEncoding);
  }),
  route("GET", "canvases/:id/raw", async (ctx) => {
    if (!ctx.creds) return notConfigured(ctx);
    const lookup = await lookupThread(ctx, ctx.creds);
    if ("response" in lookup) return lookup.response;
    const raw = await fetchCanvasRaw(lookup.threadId, ctx.creds);
    if (!raw.ok) {
      return jsonResponse({ error: raw.error }, ctx.creds, ctx.acceptEncoding, 502);
    }
    return jsonResponse(
      { editable: lookup.editable, ok: true, raw: Buffer.from(raw.bytes).toString("base64") },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
  route("POST", "canvases/:id/edit", async (ctx) => {
    if (!ctx.creds) return notConfigured(ctx);
    const edit = parseCanvasEdit(await ctx.body.json<unknown>());
    if (!edit) return errorResponse("invalid_edit", 400);
    const lookup = await lookupThread(ctx, ctx.creds);
    if ("response" in lookup) return lookup.response;
    if (!lookup.editable) return errorResponse("not_editable", 403);
    const result = await applyCanvasEdit(lookup.threadId, edit, ctx.creds);
    if (!result.ok) return errorResponse(result.error, result.status);
    return jsonResponse({ ok: true }, ctx.creds, ctx.acceptEncoding);
  }),
];
