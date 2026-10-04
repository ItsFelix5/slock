import { type Block, blockPreviewText, narrowByType, type SectionBlock } from "@slock/types";
import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import type { DraftCreateReply, DraftsListReply } from "../../slackReplies.ts";
import { type Route, route } from "../router.ts";

export const draftRoutes: Route[] = [
  route("GET", "drafts", async (ctx) => {
    const data = await callSlack<DraftsListReply>(
      "drafts.list",
      { is_active: "true", limit: "100" },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "drafts.list", ctx.creds, ctx.acceptEncoding);
    return jsonResponse(
      {
        drafts: (data.drafts ?? []).map((d) => {
          const dest = d.destinations?.[0] ?? {};
          return {
            blocks: d.blocks,
            channelId: dest.channel_id,
            clientMsgId: d.client_msg_id,
            id: d.id,
            lastUpdatedTs: d.last_updated_ts,
            text:
              blockPreviewText(d.blocks) ||
              (narrowByType<Block, SectionBlock>(d.blocks?.[0], "section")?.text?.text ?? ""),
            threadTs: dest.thread_ts,
          };
        }),
        ok: true,
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("PUT", "drafts", async (ctx) => {
    const body: {
      channelId?: string;
      threadTs?: string;
      text?: string;
      blocks?: unknown;
      draftId?: string;
      clientMsgId?: string;
      lastUpdatedTs?: string;
    } = await ctx.body.json();
    if (!(body.channelId && body.text && body.clientMsgId)) {
      return errorResponse("invalid_draft", 400);
    }
    const destination: Record<string, string> = { channel_id: body.channelId };
    if (body.threadTs) destination.thread_ts = body.threadTs;
    const blocks =
      Array.isArray(body.blocks) && body.blocks.length > 0
        ? body.blocks
        : [{ text: { text: body.text, type: "mrkdwn" }, type: "section" }];
    const params: Record<string, string> = {
      blocks: JSON.stringify(blocks),
      client_msg_id: body.clientMsgId,
      destinations: JSON.stringify([destination]),
      file_ids: "[]",
      is_from_composer: "true",
    };
    if (body.draftId) params.draft_id = body.draftId;
    if (body.lastUpdatedTs) params.client_last_updated_ts = body.lastUpdatedTs;
    const data = await callSlack<DraftCreateReply>("drafts.create", params, ctx.creds);
    if (!data.ok) {
      console.error("[drafts.create] failed", { blocks, error: data.error, params });
      return slackErrorResponse(data, "drafts.create", ctx.creds, ctx.acceptEncoding);
    }
    const draftId = data.draft?.id ?? data.id;
    if (!draftId) return errorResponse("draft_creation_failed", 502);
    const lastUpdatedTs = data.draft?.last_updated_ts ?? data.last_updated_ts;
    return jsonResponse({ id: draftId, lastUpdatedTs, ok: true }, ctx.creds, ctx.acceptEncoding);
  }),

  route("DELETE", "drafts/:id", async (ctx) => {
    const body = await ctx.body
      .json<{ lastUpdatedTs?: string }>()
      .catch((): { lastUpdatedTs?: string } => ({}));
    const knownTs = Number.parseFloat(body.lastUpdatedTs ?? "0");
    const clientLastUpdatedTs = Math.max(Date.now() / 1000, knownTs + 1);
    const sentParams = {
      client_last_updated_ts: String(clientLastUpdatedTs),
      draft_id: ctx.params.id,
    };
    const data = await callSlack("drafts.delete", sentParams, ctx.creds);
    if (!data.ok && data.error !== "draft_delete_invalid") {
      return slackErrorResponse(data, "drafts.delete", ctx.creds, ctx.acceptEncoding);
    }
    return jsonResponse({ ok: true }, ctx.creds, ctx.acceptEncoding);
  }),
];
