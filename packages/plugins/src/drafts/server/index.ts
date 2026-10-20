import type { Setup } from "@slock/core";
import type { Block } from "@slock/types";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { DraftCreateReply, DraftsListReply } from "../../slack/server/api/slackReplies";

const list: Route[] = [
  route("GET", "drafts", async (ctx) => {
    const data = await callSlack<DraftsListReply>(
      "drafts.list",
      { is_active: "true", limit: "100" },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "drafts.list", ctx.creds);
    return jsonResponse(
      {
        drafts: (data.drafts ?? []).map((d) => {
          const dest = d.destinations?.[0] ?? {};
          return {
            blocks: d.blocks ?? [],
            channelId: dest.channel_id,
            clientMsgId: d.client_msg_id,
            id: d.id,
            lastUpdatedTs: d.last_updated_ts,
            threadTs: dest.thread_ts,
          };
        }),
        ok: true,
      },
      ctx.creds,
    );
  }),

  route("PUT", "drafts", async (ctx) => {
    const body: {
      channelId?: string;
      threadTs?: string;
      blocks?: Block[];
      draftId?: string;
      clientMsgId?: string;
      lastUpdatedTs?: string;
    } = await ctx.body.json();
    if (!(body.channelId && body.blocks?.length && body.clientMsgId)) {
      return errorResponse("invalid_draft", 400);
    }
    const { blocks } = body;
    const destination: Record<string, string> = { channel_id: body.channelId };
    if (body.threadTs) destination.thread_ts = body.threadTs;
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
      return slackErrorResponse(data, "drafts.create", ctx.creds);
    }
    const draftId = data.draft?.id ?? data.id;
    if (!draftId) return errorResponse("draft_creation_failed", 502);
    const lastUpdatedTs = data.draft?.last_updated_ts ?? data.last_updated_ts;
    return jsonResponse({ id: draftId, lastUpdatedTs, ok: true }, ctx.creds);
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
      return slackErrorResponse(data, "drafts.delete", ctx.creds);
    }
    return jsonResponse({ ok: true }, ctx.creds);
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
