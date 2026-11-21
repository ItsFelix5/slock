import type { ChannelId, Ts } from "@slock/types";
import { errorResponse, okResponse, slackErrorResponse } from "./jsonResponse.ts";
import type { RouteCtx } from "./router.ts";
import { callSlack } from "./slackClient.ts";

const RELAY_COMMAND = "/slock-relay";

type RelayAction =
  | { action: "post"; text?: string; threadTs?: Ts; blocks?: unknown; unfurl?: string[] }
  | { action: "edit"; ts: Ts; text?: string; blocks?: unknown }
  | { action: "delete"; ts: Ts };

async function sendRelayAction(ctx: RouteCtx, channel: ChannelId, action: RelayAction) {
  const { creds } = ctx;
  if (!creds) return errorResponse("not_configured", 401);
  const sent = await callSlack(
    "chat.command",
    { channel, command: RELAY_COMMAND, text: JSON.stringify(action) },
    creds,
  );
  return sent.ok ? okResponse() : slackErrorResponse(sent, "relay");
}

export function relayBroadcast(ctx: RouteCtx, channel: ChannelId, body: object) {
  return sendRelayAction(ctx, channel, { ...body, action: "post" });
}

export function relayEdit(ctx: RouteCtx, channel: ChannelId, ts: Ts, body: object) {
  return sendRelayAction(ctx, channel, { ...body, action: "edit", ts });
}

export function relayDelete(ctx: RouteCtx, channel: ChannelId, ts: Ts) {
  return sendRelayAction(ctx, channel, { action: "delete", ts });
}
