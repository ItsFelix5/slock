// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { errorResponse, jsonResponse, slackErrorResponse } from "../http/jsonResponse.ts";
import { callSlack } from "../slackClient.ts";
import { trimFile } from "../trim/slackEntities.ts";
import { mutate, type Route, route } from "./router.ts";

export const canvasRoutes: Route[] = [
  // A channel's own single canvas tab.
  route("POST", "/api/channels/:id/canvas", async (ctx) => {
    const { title } = (await ctx.body.json()) as { title?: string };
    const data = await callSlack(
      "conversations.canvases.create",
      {
        channel_id: ctx.params.id,
        document_content: JSON.stringify({ markdown: "", type: "markdown" }),
        ...(title ? { title } : {}),
      },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(
        data,
        "conversations.canvases.create",
        ctx.creds,
        ctx.acceptEncoding,
      );
    }
    if (!data.canvas_id) return errorResponse("canvas_creation_failed", 502);
    return jsonResponse({ canvasId: data.canvas_id, ok: true }, ctx.creds, ctx.acceptEncoding);
  }),

  // A standalone canvas shared into a channel (the "+" canvas tab, as opposed
  // to the channel's own single canvas above) — one route for what's
  // otherwise create-then-share across two Slack calls, so the browser only
  // makes one round trip.
  route("POST", "/api/canvases", async (ctx) => {
    const { title, channelId } = (await ctx.body.json()) as { title?: string; channelId?: string };
    if (!(title && channelId)) return errorResponse("invalid_canvas", 400);
    const created = await callSlack(
      "canvases.create",
      { document_content: JSON.stringify({ markdown: "", type: "markdown" }), title },
      ctx.creds,
    );
    if (!created.ok) {
      return slackErrorResponse(created, "canvases.create", ctx.creds, ctx.acceptEncoding);
    }
    if (!created.canvas_id) return errorResponse("canvas_creation_failed", 502);
    const shared = await callSlack(
      "canvases.access.set",
      { access_level: "write", canvas_id: created.canvas_id, channel_ids: channelId },
      ctx.creds,
    );
    if (!shared.ok) {
      return slackErrorResponse(shared, "canvases.access.set", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse({ canvasId: created.canvas_id, ok: true }, ctx.creds, ctx.acceptEncoding);
  }),

  route("PUT", "/api/canvases/:id", async (ctx) => {
    const { markdown } = (await ctx.body.json()) as { markdown?: string };
    if (markdown === undefined) return errorResponse("invalid_markdown", 400);
    const changes = JSON.stringify([
      { document_content: { markdown, type: "markdown" }, operation: "replace" },
    ]);
    return mutate("canvases.edit", { canvas_id: ctx.params.id, changes }, ctx);
  }),

  // Canvases are backed by a regular Slack file sharing the same id, so this
  // is files.info projected to just the title/download URL a canvas tab needs
  // — not the ~25-field trimFile used for message attachments.
  route("GET", "/api/canvases/:id/file-info", async (ctx) => {
    const data = await callSlack("files.info", { file: ctx.params.id }, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "files.info", ctx.creds, ctx.acceptEncoding);
    }
    const file = trimFile(data.file);
    return jsonResponse(
      {
        ok: true,
        title: file?.title?.trim() || file?.name?.trim() || null,
        url: file?.url_private_download ?? file?.url_private ?? null,
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
];
