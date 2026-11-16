import { errorResponse, okResponse, slackErrorResponse } from "./jsonResponse.ts";
import type { RouteCtx } from "./router.ts";
import { callSlack } from "./slackClient.ts";

const RELAY_COMMAND = "/slock-relay";
const TRAILING_SLASHES = /\/+$/;

type RelayAction =
  | {
      action: "post";
      text?: string;
      threadTs?: string;
      blocks?: unknown;
      unfurl?: string[];
      uploadId?: string;
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

export async function relayUpload(
  ctx: RouteCtx,
  uploadId: string | null,
  filename: string | null,
  file: Uint8Array,
) {
  const url = Bun.env.SLOCK_RELAY_URL?.replace(TRAILING_SLASHES, "");
  if (!ctx.creds) return errorResponse("not_configured", 401);
  if (!url) return errorResponse("This server isn't set up to send files with @channel.", 400);
  const params = new URLSearchParams({ filename: filename ?? "file", uploadId: uploadId ?? "" });
  try {
    const res = await fetch(`${url}/files?${params}`, {
      body: new Blob([new Uint8Array(file)]),
      method: "POST",
    });
    return res.ok ? okResponse(ctx.creds) : errorResponse("The relay rejected the file.", 502);
  } catch {
    return errorResponse("Couldn't reach the relay.", 502);
  }
}
