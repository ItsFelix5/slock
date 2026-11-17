import { teamIdFromRoute } from "./auth.ts";
import { errorResponse, jsonResponse, okResponse, slackErrorResponse } from "./jsonResponse.ts";
import type { RouteCtx } from "./router.ts";
import { callSlack, parseSlackResponse } from "./slackClient.ts";

const RELAY_COMMAND = "/slock-relay";
const TRAILING_SLASHES = /\/+$/;

type RelayAction =
  | {
      action: "post";
      text?: string;
      threadTs?: string;
      blocks?: unknown;
      unfurl?: string[];
      files?: { id: string; title: string }[];
    }
  | {
      action: "edit";
      ts: string;
      text?: string;
      blocks?: unknown;
      fileIds?: string[];
      replyBroadcast?: boolean;
    }
  | { action: "delete"; ts: string };

async function sendRelayAction(ctx: RouteCtx, channel: string, action: RelayAction) {
  const { creds } = ctx;
  if (!creds) return errorResponse("not_configured", 401);
  const sent = await callSlack(
    "chat.command",
    { channel, command: RELAY_COMMAND, text: JSON.stringify(action) },
    creds,
  );
  return sent.ok ? okResponse(creds) : slackErrorResponse(sent, "relay", creds);
}

export function relayBroadcast(ctx: RouteCtx, channel: string, body: object) {
  return sendRelayAction(ctx, channel, { ...body, action: "post" });
}

export function relayEdit(ctx: RouteCtx, channel: string, ts: string, body: object) {
  return sendRelayAction(ctx, channel, { ...body, action: "edit", ts });
}

export function relayDelete(ctx: RouteCtx, channel: string, ts: string) {
  return sendRelayAction(ctx, channel, { action: "delete", ts });
}

export async function relayReserve(ctx: RouteCtx, filename: string, length: string) {
  const url = Bun.env.SLOCK_RELAY_URL?.replace(TRAILING_SLASHES, "");
  if (!ctx.creds) return errorResponse("not_configured", 401);
  if (!url) return errorResponse("This server isn't set up to send files with @channel.", 400);
  try {
    const res = await fetch(`${url}/reserve`, {
      body: JSON.stringify({ filename, length, team: teamIdFromRoute(ctx.creds.route) }),
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });
    const reply = await parseSlackResponse<{ file_id: string; upload_url: string }>(res);
    if (!reply.ok) return errorResponse(reply.error, 502);
    return jsonResponse({ file_id: reply.file_id, upload_url: reply.upload_url }, ctx.creds);
  } catch {
    return errorResponse("Couldn't reach the relay.", 502);
  }
}
