import type { Env, Setup } from "@slock/core";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { route, routes } from "@slock/plugins/slack/server/api/router";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import type { RawDraft } from "@slock/plugins/slack/server/api/slackReplies";
import { trimDraft } from "@slock/plugins/slack/server/api/trim/slackDrafts";
import type { Block, DraftEntry } from "@slock/types";

const draftRoutes = (env: Env): Route[] => [
  route("GET", "drafts", async (ctx) => {
    const data = await callSlack<DraftsListReply>(
      "drafts.list",
      { is_active: "true", limit: "100" },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "drafts.list");
    return jsonResponse({
      drafts: trimDrafts(data.drafts ?? []),
      ok: true,
    });
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
      console.error("[drafts.create] failed", data.error);
      return slackErrorResponse(data, "drafts.create");
    }
    const draftId = data.draft?.id ?? data.id;
    if (!draftId) return errorResponse("draft_creation_failed", 502);
    const lastUpdatedTs = data.draft?.last_updated_ts ?? data.last_updated_ts;
    return jsonResponse({ id: draftId, lastUpdatedTs, ok: true });
  }),

  route("DELETE", "drafts/:id", async (ctx) => {
    const body = await ctx.body.json<{ lastUpdatedTs?: string }>();
    const knownTs = Number.parseFloat(body.lastUpdatedTs ?? "0");
    const clientLastUpdatedTs = Math.max(env.now() / 1000, knownTs + 1);
    const sentParams = {
      client_last_updated_ts: String(clientLastUpdatedTs),
      draft_id: ctx.params.id,
    };
    const data = await callSlack("drafts.delete", sentParams, ctx.creds);
    if (!data.ok && data.error !== "draft_delete_invalid") {
      return slackErrorResponse(data, "drafts.delete");
    }
    return jsonResponse({ ok: true });
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(draftRoutes(ctx.get("env"))));
};

export default setup;

type DraftsListReply = { drafts?: RawDraft[] };

type DraftCreateReply = {
  draft?: { id?: string; last_updated_ts?: string };
  id?: string;
  last_updated_ts?: string;
};

export function trimDrafts(drafts: readonly RawDraft[]): DraftEntry[] {
  return drafts.flatMap((draft) => trimDraft(draft) ?? []);
}
