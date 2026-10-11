import type { HttpHandler, Setup } from "@slock/core";
import { isRecord } from "@slock/core";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { FileInfoReply } from "../../slack/server/api/slackReplies";
import { trimFile } from "../../slack/server/api/trim/slackMessages";
import { fetchCanvasRaw, lookupThread, notConfigured } from "./api";
import { commentRoutes } from "./comments";
import { applyCanvasEdit } from "./edit";
import { historyRoutes } from "./history";
import { parseCanvasEdit } from "./parseEdit";

const list: Route[] = [
  route("GET", "canvases/:id/file-info", async (ctx) => {
    const data = await callSlack<FileInfoReply>("files.info", { file: ctx.params.id }, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "files.info", ctx.creds);
    }
    return jsonResponse({ file: trimFile(data.file), ok: true }, ctx.creds);
  }),

  route("GET", "canvases/:id/raw", async (ctx) => {
    if (!ctx.creds) return notConfigured();
    const lookup = await lookupThread(ctx, ctx.creds);
    if ("response" in lookup) return lookup.response;
    const raw = await fetchCanvasRaw(lookup.threadId, ctx.creds);
    if (!raw.ok) {
      return jsonResponse({ error: raw.error }, ctx.creds, 502);
    }
    return jsonResponse(
      { editable: lookup.editable, ok: true, raw: Buffer.from(raw.bytes).toString("base64") },
      ctx.creds,
    );
  }),

  route("POST", "canvases/:id/edit", async (ctx) => {
    if (!ctx.creds) return notConfigured();
    const edit = parseCanvasEdit(await ctx.body.json<unknown>());
    if (!edit) return errorResponse("invalid_edit", 400);
    const lookup = await lookupThread(ctx, ctx.creds);
    if ("response" in lookup) return lookup.response;
    if (!lookup.editable) return errorResponse("not_editable", 403);
    const result = await applyCanvasEdit(lookup.threadId, edit, ctx.creds);
    if (!result.ok) return errorResponse(result.error, result.status);
    return jsonResponse({ ok: true }, ctx.creds);
  }),
];

const RENAME_PATH = /^\/api\/files\/([^/]+)\/rename$/;

const renameCanvas: HttpHandler = async (c, next) => {
  const fileId = c.req.method === "POST" ? RENAME_PATH.exec(c.url.pathname)?.[1] : undefined;
  if (!(fileId && c.creds)) return next();
  const info = await callSlack<FileInfoReply>("files.info", { file: fileId }, c.creds);
  const threadId = info.ok ? info.file.quip_thread_id : undefined;
  if (!threadId) return next();
  const body: unknown = await c.req.json();
  const name = isRecord(body) && typeof body.title === "string" ? body.title.trim() : "";
  if (!name) return errorResponse("invalid_title", 400);
  const result = await applyCanvasEdit(
    threadId,
    { controls: [], deleted: [], title: name, upserts: [] },
    c.creds,
  );
  return result.ok
    ? jsonResponse({ ok: true }, c.creds)
    : errorResponse(result.error, result.status);
};

const setup: Setup = (ctx) => {
  ctx.add("http", routes([...list, ...historyRoutes, ...commentRoutes]));
  ctx.add("http", renameCanvas);
};

export default setup;
