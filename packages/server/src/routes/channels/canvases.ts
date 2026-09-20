import { fetchCanvasRaw } from "../../canvasRaw.ts";
import { jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import { trimFile } from "../../trim/slackEntities.ts";
import { type Route, route } from "../router.ts";

export const canvasRoutes: Route[] = [
  route("GET", "canvases/:id/file-info", async (ctx) => {
    const data = await callSlack("files.info", { file: ctx.params.id }, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "files.info", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse({ file: trimFile(data.file), ok: true }, ctx.creds, ctx.acceptEncoding);
  }),
  route("GET", "canvases/:id/raw", async (ctx) => {
    if (!ctx.creds)
      return slackErrorResponse(
        { error: "not_configured" },
        "files.info",
        null,
        ctx.acceptEncoding,
      );
    const data = await callSlack("files.info", { file: ctx.params.id }, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "files.info", ctx.creds, ctx.acceptEncoding);
    }
    const threadId = data.file?.quip_thread_id;
    if (typeof threadId !== "string" || !threadId) {
      console.error(
        `[canvas] no quip_thread_id on file ${ctx.params.id}, file keys:`,
        Object.keys(data.file ?? {}),
      );
      return jsonResponse(
        { error: "canvas has no quip_thread_id" },
        ctx.creds,
        ctx.acceptEncoding,
        502,
      );
    }
    const raw = await fetchCanvasRaw(threadId, ctx.creds);
    if (!raw.ok) {
      return jsonResponse({ error: raw.error }, ctx.creds, ctx.acceptEncoding, 502);
    }
    return jsonResponse(
      { ok: true, raw: Buffer.from(raw.bytes).toString("base64") },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
];
