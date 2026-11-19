import { errorResponse, okResponse, slackErrorResponse } from "./jsonResponse.ts";
import type { RouteCtx } from "./router.ts";
import { callSlack } from "./slackClient.ts";

const RELAY_COMMAND = "/slock-relay";

type RelayAction =
  | { action: "post"; text?: string; threadTs?: string; blocks?: unknown; unfurl?: string[] }
  | { action: "edit"; ts: string; text?: string; blocks?: unknown }
  | { action: "delete"; ts: string };

async function sendRelayAction(ctx: RouteCtx, channel: string, action: RelayAction) {
  const { creds } = ctx;
  if (!creds) return errorResponse("not_configured", 401);
  const sent = await callSlack(
    "chat.command",
    { channel, command: RELAY_COMMAND, text: JSON.stringify(action) },
    creds,
  );
  return sent.ok ? okResponse() : slackErrorResponse(sent, "relay");
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
