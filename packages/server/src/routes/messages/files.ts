import { slackUploadResponse, uploadCapability } from "../../assets.ts";
import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import { trimFile } from "../../trim/slackEntities.ts";
import { type Route, route } from "../router.ts";

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

export const fileRoutes: Route[] = [
  route("GET", "files/:id/detail", async (ctx) => {
    const [infoData, sharesData] = await Promise.all([
      callSlack(
        "files.info",
        { count: "1000", file: ctx.params.id, include_transcription: "true" },
        ctx.creds,
      ),
      callSlack("files.getShares", { file_id: ctx.params.id }, ctx.creds),
    ]);
    if (!infoData.ok) {
      return slackErrorResponse(infoData, "files.info", ctx.creds, ctx.acceptEncoding);
    }
    if (!sharesData.ok) {
      return slackErrorResponse(sharesData, "files.getShares", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse(
      {
        content: infoData.content ?? null,
        contentTruncated: !!infoData.is_truncated,
        file: trimFile(infoData.file),
        ok: true,
        shares: flattenShares(sharesData.conversation_shares?.shares),
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
  route("POST", "files/reserve", async (ctx) => {
    const params = await (ctx.body.json() as Promise<Record<string, string>>);
    if (!(params.filename && params.length)) return errorResponse("invalid_file", 400);
    const reservation = await callSlack(
      "files.getUploadURLExternal",
      { filename: params.filename, length: params.length },
      ctx.creds,
    );
    if (!(reservation.ok && reservation.upload_url && ctx.creds)) {
      return errorResponse(reservation.error ?? "file reservation failed", 502);
    }
    const capability = uploadCapability(reservation.upload_url, ctx.creds);
    if (!capability) return errorResponse("invalid_upload_url", 502);
    return jsonResponse(
      { file_id: reservation.file_id, upload_token: capability },
      ctx.creds,
      ctx.acceptEncoding,
    );
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
    const data = await callSlack(
      "files.completeUploadExternal",
      await (ctx.body.json() as Promise<Record<string, string>>),
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(
        data,
        "files.completeUploadExternal",
        ctx.creds,
        ctx.acceptEncoding,
      );
    }
    return jsonResponse({}, ctx.creds, ctx.acceptEncoding);
  }),
];
