import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route, RouteCtx } from "@slock/plugins/slack/server/api/router";
import { route } from "@slock/plugins/slack/server/api/router";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";

import { lookupThread, notConfigured } from "./api";
import type { CanvasWire } from "./wire";

const HISTORY_REASON = "quip-history";

const VERSION_LIMIT = "300";

function versionQuery(ctx: RouteCtx): { documentId: string; sequence: number } | null {
  const documentId = ctx.searchParams.get("document");
  const sequence = Number(ctx.searchParams.get("sequence"));
  return documentId && Number.isInteger(sequence) ? { documentId, sequence } : null;
}

export const historyRoutes = (wire: CanvasWire): Route[] => [
  route("GET", "canvases/:id/versions", async (ctx) => {
    if (!ctx.creds) return notConfigured();
    const data = await callSlack<CanvasVersionsReply>(
      "quip.history.getVersions",
      { file_id: ctx.params.id, limit: VERSION_LIMIT, reason: HISTORY_REASON },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "quip.history.getVersions");
    const versions = (data.versions ?? []).flatMap((version) =>
      version.version_id && version.sequence !== undefined
        ? [
            {
              authorId: version.author ?? "",
              commentOnly: !!version.is_comment_only,
              createdMs: version.created_ms ?? 0,
              sequence: version.sequence,
              versionId: version.version_id,
            },
          ]
        : [],
    );
    return jsonResponse({ ok: true, versions });
  }),

  route("GET", "canvases/:id/versions/:versionId", async (ctx) => {
    if (!ctx.creds) return notConfigured();
    const query = versionQuery(ctx);
    if (!query) return errorResponse("invalid_version", 400);
    const lookup = await lookupThread(ctx.params.id, ctx.creds);
    if ("response" in lookup) return lookup.response;
    const raw = await wire.fetchVersion(
      lookup.threadId,
      { ...query, versionId: ctx.params.versionId },
      ctx.creds,
    );
    if (!raw.ok) return jsonResponse({ error: raw.error }, 502);
    return jsonResponse({ ok: true, raw: Buffer.from(raw.bytes).toString("base64") });
  }),

  route("POST", "canvases/:id/versions/:versionId/restore", async (ctx) => {
    if (!ctx.creds) return notConfigured();
    const { sequence } = await ctx.body.json<{ sequence?: number }>();
    if (!Number.isInteger(sequence)) return errorResponse("invalid_version", 400);
    const lookup = await lookupThread(ctx.params.id, ctx.creds);
    if ("response" in lookup) return lookup.response;
    if (lookup.access !== "edit") return errorResponse("not_editable", 403);
    const data = await callSlack<{ created_version_id?: string }>(
      "quip.history.restoreVersion",
      {
        file_id: ctx.params.id,
        reason: `${HISTORY_REASON}-restore`,
        sequence: String(sequence),
        version_id: ctx.params.versionId,
      },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "quip.history.restoreVersion");
    return jsonResponse({ ok: true });
  }),
];

type CanvasVersionsReply = {
  versions?: {
    author?: string;
    created_ms?: number;
    is_comment_only?: boolean;
    sequence?: number;
    version_id?: string;
  }[];
};
