import { jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import { trimFile } from "../../trim/slackEntities.ts";
import { type Route, route } from "../router.ts";

function flattenShares(sharesRoot: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  if (!sharesRoot || typeof sharesRoot !== "object") return out;
  for (const byChannel of Object.values(sharesRoot as Record<string, unknown>)) {
    if (!byChannel || typeof byChannel !== "object") continue;
    for (const [channelId, entries] of Object.entries(byChannel as Record<string, unknown>)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) out.push({ channel_id: channelId, ...entry });
    }
  }
  return out;
}

export const fileRoutes: Route[] = [
  route("GET", "/api/files/:id/detail", async (ctx) => {
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
];
