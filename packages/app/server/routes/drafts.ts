// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { errorResponse, jsonResponse, slackErrorResponse } from "../http/jsonResponse.ts";
import { callSlack } from "../slackClient.ts";
import { mutate, type Route, route } from "./router.ts";

export const draftRoutes: Route[] = [
  route("GET", "/api/drafts", async (ctx) => {
    const data = await callSlack("drafts.list", { is_active: "true", limit: "100" }, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "drafts.list", ctx.creds, ctx.acceptEncoding);
    const drafts: any[] = Array.isArray(data.drafts) ? data.drafts : [];
    return jsonResponse(
      {
        drafts: drafts.map((d) => {
          const dest = d.destinations?.[0] ?? {};
          return {
            channelId: dest.channel_id,
            clientMsgId: d.client_msg_id,
            id: d.id,
            text: d.blocks?.[0]?.text?.text ?? "",
            threadTs: dest.thread_ts,
          };
        }),
        ok: true,
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  // Upsert: `draftId` present updates that draft's row, otherwise a new one
  // is created (the composer's own debounce owns deciding which).
  route("PUT", "/api/drafts", async (ctx) => {
    const body = (await ctx.body.json()) as {
      channelId?: string;
      threadTs?: string;
      text?: string;
      draftId?: string;
      clientMsgId?: string;
    };
    if (!(body.channelId && body.text && body.clientMsgId)) {
      return errorResponse("invalid_draft", 400);
    }
    const destination: Record<string, string> = { channel_id: body.channelId };
    if (body.threadTs) destination.thread_ts = body.threadTs;
    const params: Record<string, string> = {
      blocks: JSON.stringify([{ text: { text: body.text, type: "mrkdwn" }, type: "section" }]),
      client_msg_id: body.clientMsgId,
      destinations: JSON.stringify([destination]),
      file_ids: "[]",
      is_from_composer: "true",
    };
    if (body.draftId) params.draft_id = body.draftId;
    const data = await callSlack("drafts.create", params, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "drafts.create", ctx.creds, ctx.acceptEncoding);
    const draftId = data.draft?.id ?? data.id;
    if (!draftId) return errorResponse("draft_creation_failed", 502);
    return jsonResponse({ id: draftId, ok: true }, ctx.creds, ctx.acceptEncoding);
  }),

  route("DELETE", "/api/drafts/:id", (ctx) =>
    mutate(
      "drafts.delete",
      { client_last_updated_ts: String(Date.now() / 1000), draft_id: ctx.params.id },
      ctx,
    ),
  ),
];
