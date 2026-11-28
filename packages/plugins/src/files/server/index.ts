import type { Setup } from "@slock/core";
import { slackUploadResponse } from "@slock/plugins/slack/server/api/assets";

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
import { hostedChannelId } from "@slock/slack";
import type { RawFile, RawFileShare } from "@slock/types";
import { accessRoutes, fileAccess } from "./access";

function flattenShares(sharesRoot: unknown): RawFileShare[] {
  const out: RawFileShare[] = [];
  if (!sharesRoot || typeof sharesRoot !== "object") return out;
  for (const byChannel of Object.values(sharesRoot)) {
    if (!byChannel || typeof byChannel !== "object") continue;
    for (const [channelId, entries] of Object.entries(byChannel)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) out.push({ channel_id: channelId, ...entry });
    }
  }
  return out;
}

const list: Route[] = [
  route("GET", "files/:id/detail", async (ctx) => {
    const [infoData, sharesData] = await Promise.all([
      callSlack<FileInfoReply>(
        "files.info",
        { count: "1000", file: ctx.params.id, include_transcription: "true" },
        ctx.creds,
      ),
      callSlack<FileSharesReply>("files.getShares", { file_id: ctx.params.id }, ctx.creds),
    ]);
    if (!infoData.ok) {
      return slackErrorResponse(infoData, "files.info");
    }
    if (!sharesData.ok) {
      return slackErrorResponse(sharesData, "files.getShares");
    }
    const { file } = infoData;
    const shares = flattenShares(sharesData.conversation_shares?.shares).filter(
      (share) => share.channel_id !== hostedChannelId(ctx.params.id),
    );
    return jsonResponse({
      access: await fileAccess(file, shares, ctx.creds),
      content: infoData.content ?? null,
      contentTruncated: !!infoData.is_truncated,
      editable: file.editable === true,
      file: trimFile(file),
      ok: true,
      shares,
      starred: !!file.is_starred,
      viewer_count: sharesData.viewer_count ?? null,
    });
  }),

  route("POST", "files/:id/rename", async (ctx) => {
    if (!ctx.creds) return errorResponse("not_configured", 400);
    const { title } = await ctx.body.json<{ title?: string }>();
    const name = title?.trim();
    if (!name) return errorResponse("invalid_title", 400);
    const edited = await callSlack("files.edit", { file: ctx.params.id, title: name }, ctx.creds);
    if (!edited.ok) return slackErrorResponse(edited, "files.edit");
    return jsonResponse({ ok: true });
  }),

  ...accessRoutes,

  route("POST", "files/reserve", async (ctx) => {
    const params = await ctx.body.json<Record<string, string>>();
    if (!(params.filename && params.length)) return errorResponse("invalid_file", 400);
    const reservation = await callSlack<UploadReservationReply>(
      "files.getUploadURLExternal",
      { filename: params.filename, length: params.length },
      ctx.creds,
    );
    if (!reservation.ok) return errorResponse(reservation.error, 502);
    if (!(reservation.upload_url && ctx.creds))
      return errorResponse("file reservation failed", 502);
    return jsonResponse({ file_id: reservation.file_id, upload_url: reservation.upload_url });
  }),

  route("POST", "files/upload", async (ctx) =>
    slackUploadResponse(
      await ctx.body.buffer(),
      ctx.searchParams.get("url"),
      ctx.searchParams.get("filename"),
    ),
  ),

  route("POST", "files/complete", async (ctx) => {
    const data = await callSlack<FilesCompleteReply>(
      "files.completeUploadExternal",
      await ctx.body.json<Record<string, string>>(),
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "files.completeUploadExternal");
    }
    const files = data.files?.map(trimFile) ?? [];
    return jsonResponse({ files });
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;

type UploadReservationReply = { file_id?: string; upload_url?: string };

type FilesCompleteReply = { files?: RawFile[] };

type FileSharesReply = {
  conversation_shares?: { shares?: unknown };
  viewer_count?: number;
};
