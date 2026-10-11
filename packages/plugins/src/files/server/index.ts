import type { Setup } from "@slock/core";
import { slackUploadResponse, uploadCapability } from "../../slack/server/api/assets";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type {
  FileInfoReply,
  FileSharesReply,
  FilesCompleteReply,
  UploadReservationReply,
} from "../../slack/server/api/slackReplies";
import { hostedChannelId } from "../../slack/server/api/trim/slackChannels";
import { trimFile } from "../../slack/server/api/trim/slackMessages";

function flattenShares(sharesRoot: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
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

type AccessTarget = { channelId?: string; userId?: string };

function accessTarget({ channelId, userId }: AccessTarget): Record<string, string> | null {
  if (userId) return { user_ids: JSON.stringify([userId]) };
  if (channelId) return { channel_ids: JSON.stringify([channelId]) };
  return null;
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
      return slackErrorResponse(infoData, "files.info", ctx.creds);
    }
    if (!sharesData.ok) {
      return slackErrorResponse(sharesData, "files.getShares", ctx.creds);
    }
    const { file } = infoData;
    return jsonResponse(
      {
        access: {
          org_id: file.user_team ?? null,
          org_level: file.org_or_workspace_access ?? "none",
          users: (file.dm_mpdm_users_with_file_access ?? []).flatMap((entry) =>
            entry.user_id ? [{ access: entry.access ?? "read", user_id: entry.user_id }] : [],
          ),
        },
        content: infoData.content ?? null,
        contentTruncated: !!infoData.is_truncated,
        editable: file.editable !== false,
        file: trimFile(file),
        ok: true,
        owner: file.canvas_creator_id ?? file.user ?? null,
        shares: flattenShares(sharesData.conversation_shares?.shares).filter(
          (share) => share.channel_id !== hostedChannelId(ctx.params.id),
        ),
        starred: !!file.is_starred,
        viewer_count: sharesData.viewer_count ?? null,
      },
      ctx.creds,
    );
  }),

  route("POST", "files/:id/rename", async (ctx) => {
    if (!ctx.creds) return errorResponse("not_configured", 400);
    const { title } = await ctx.body.json<{ title?: string }>();
    const name = title?.trim();
    if (!name) return errorResponse("invalid_title", 400);
    const edited = await callSlack("files.edit", { file: ctx.params.id, title: name }, ctx.creds);
    if (!edited.ok) return slackErrorResponse(edited, "files.edit", ctx.creds);
    return jsonResponse({ ok: true }, ctx.creds);
  }),

  route("POST", "files/:id/access", async (ctx) => {
    const { channelId, level, orgId, userId } = await ctx.body.json<
      AccessTarget & { level?: string; orgId?: string }
    >();
    if (!level) return errorResponse("invalid_access", 400);
    if (channelId && orgId) {
      return mutate(
        "files.updatePermission",
        {
          channel_id_access_level_map: JSON.stringify([
            { access_level: level, channel_id: channelId },
          ]),
          file_id: ctx.params.id,
          team_id: orgId,
        },
        ctx,
      );
    }
    if (!userId) return errorResponse("invalid_access", 400);
    return mutate(
      "canvases.access.set",
      { access_level: level, canvas_id: ctx.params.id, user_ids: JSON.stringify([userId]) },
      ctx,
    );
  }),

  route("POST", "files/:id/access/remove", async (ctx) => {
    const target = accessTarget(await ctx.body.json<AccessTarget>());
    if (!target) return errorResponse("invalid_access", 400);
    return mutate("canvases.access.delete", { canvas_id: ctx.params.id, ...target }, ctx);
  }),

  route("POST", "files/:id/org-access", async (ctx) => {
    const { level, orgId } = await ctx.body.json<{ level?: string; orgId?: string }>();
    if (!(level && orgId)) return errorResponse("invalid_access", 400);
    const entity = { entity_id: orgId, entity_type: "org", file_id: ctx.params.id };
    return level === "none"
      ? mutate("files.disableCrossWorkspaceLinkSharing", entity, ctx)
      : mutate("files.enableCrossWorkspaceLinkSharing", { ...entity, access_level: level }, ctx);
  }),

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
    const capability = uploadCapability(reservation.upload_url, ctx.creds);
    if (!capability) return errorResponse("invalid_upload_url", 502);
    return jsonResponse({ file_id: reservation.file_id, upload_token: capability }, ctx.creds);
  }),

  route("POST", "files/upload/:capability", async (ctx) =>
    slackUploadResponse(
      await ctx.body.buffer(),
      ctx.params.capability,
      ctx.searchParams.get("filename"),
      ctx.creds,
    ),
  ),

  route("POST", "files/complete", async (ctx) => {
    const data = await callSlack<FilesCompleteReply>(
      "files.completeUploadExternal",
      await ctx.body.json<Record<string, string>>(),
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "files.completeUploadExternal", ctx.creds);
    }
    const files = data.files?.map(trimFile) ?? [];
    return jsonResponse({ files }, ctx.creds);
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
