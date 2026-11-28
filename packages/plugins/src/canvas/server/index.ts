import type { Setup } from "@slock/core";
import { isRecord } from "@slock/core";
import type { HttpHandler } from "@slock/core/http";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { route, routes } from "@slock/plugins/slack/server/api/router";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import type { FileInfoReply } from "@slock/plugins/slack/server/api/slackReplies";
import { trimFile } from "@slock/plugins/slack/server/api/trim/slackMessages";
import { canvasAccess, notConfigured, openCanvas } from "./api";
import { commentRoutes } from "./comments";
import { applyCanvasEdit, controlContext } from "./edit";
import { historyRoutes } from "./history";
import { parseCanvasEdit } from "./parseEdit";
import { type CanvasWire, createCanvasWire } from "./wire";

const listRoutes = (wire: CanvasWire): Route[] => [
  route("GET", "canvases/:id/file-info", async (ctx) => {
    const data = await callSlack<FileInfoReply>("files.info", { file: ctx.params.id }, ctx.creds);
    if (!data.ok) {
      if (data.error === "file_not_found") return jsonResponse({ file: null, ok: true });
      return slackErrorResponse(data, "files.info");
    }
    return jsonResponse({ file: trimFile(data.file), ok: true });
  }),

  route("GET", "canvases/:id/raw", async (ctx) => {
    if (!ctx.creds) return notConfigured();
    const hint = ctx.searchParams.get("thread");
    const canvas = await openCanvas(wire, ctx.params.id, hint, ctx.creds);
    if ("response" in canvas) return canvas.response;
    const { access, raw } = canvas;
    if (!raw.ok) return jsonResponse({ error: raw.error }, 502);
    return jsonResponse({ access, ok: true, raw: Buffer.from(raw.bytes).toString("base64") });
  }),

  route("POST", "canvases/:id/edit", async (ctx) => {
    if (!ctx.creds) return notConfigured();
    const edit = parseCanvasEdit(await ctx.body.json<unknown>());
    if (!edit) return errorResponse("invalid_edit", 400);
    const hint = ctx.searchParams.get("thread");
    const [canvas, context] = await Promise.all([
      openCanvas(wire, ctx.params.id, hint, ctx.creds),
      controlContext(edit, ctx.creds),
    ]);
    if ("response" in canvas) return canvas.response;
    const { access, raw } = canvas;
    if (access === "view") return errorResponse("not_editable", 403);
    if (!raw.ok) return errorResponse(raw.error, 502);
    const target = { access, context, raw: raw.bytes };
    const result = await applyCanvasEdit(wire, target, edit, ctx.creds);
    if (!result.ok) return errorResponse(result.error, result.status);
    return jsonResponse({ ok: true });
  }),
];

const RENAME_PATH = /^\/api\/files\/([^/]+)\/rename$/;

const renameCanvas =
  (wire: CanvasWire): HttpHandler =>
  async (c, next) => {
    const fileId = c.req.method === "POST" ? RENAME_PATH.exec(c.url.pathname)?.[1] : undefined;
    if (!(fileId && c.creds)) return next();
    const info = await callSlack<FileInfoReply>("files.info", { file: fileId }, c.creds);
    const threadId = info.ok ? info.file.quip_thread_id : undefined;
    if (!threadId) return next();
    if (info.ok && canvasAccess(info.file) !== "edit") return errorResponse("not_editable", 403);
    const body: unknown = await c.req.json();
    const name = isRecord(body) && typeof body.title === "string" ? body.title.trim() : "";
    if (!name) return errorResponse("invalid_title", 400);
    const raw = await wire.fetchRaw(threadId, c.creds);
    if (!raw.ok) return errorResponse(raw.error, 502);
    const edit = { controls: [], deleted: [], title: name, upserts: [] };
    const context = await controlContext(edit, c.creds);
    const result = await applyCanvasEdit(
      wire,
      { access: "edit", context, raw: raw.bytes },
      edit,
      c.creds,
    );
    return result.ok ? jsonResponse({ ok: true }) : errorResponse(result.error, result.status);
  };

const setup: Setup = (ctx) => {
  const wire = createCanvasWire(ctx.get("env"));
  ctx.add("http", routes([...listRoutes(wire), ...historyRoutes(wire), ...commentRoutes(wire)]));
  ctx.add("http", renameCanvas(wire));
};

export default setup;
