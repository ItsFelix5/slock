import { errorMessage } from "@slock/core";
import type { Credentials } from "./auth.ts";
import { errorResponse, jsonResponse, slackErrorResponse } from "./jsonResponse.ts";
import type { RouteCtx } from "./router.ts";
import { callSlack, parseSlackResponse, type SlackReply } from "./slackClient.ts";

const RELAY_COMMAND = "/slock-relay";
const RELAY_TIMEOUT_MS = 120_000;
const TRAILING_SLASHES = /\/+$/;

type Content = { text?: string; blocks?: unknown };

type RelayAction =
  | ({
      action: "post";
      threadTs?: string;
      replyBroadcast?: boolean;
      unfurl?: string[];
    } & Content)
  | ({ action: "edit"; ts: string; replyBroadcast?: boolean; fileIds?: string[] } & Content)
  | { action: "delete"; ts: string };

export function relayUrl(): string | undefined {
  return Bun.env.SLOCK_RELAY_URL?.replace(TRAILING_SLASHES, "") || undefined;
}

export async function callRelay<T extends object = object>(
  token: string,
  method: string,
  path: string,
  body?: FormData | string,
  headers?: Record<string, string>,
): Promise<SlackReply<T>> {
  try {
    const res = await fetch(`${relayUrl()}${path}`, {
      body,
      headers: { ...headers, authorization: `Bearer ${token}` },
      method,
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
    });
    return await parseSlackResponse<T>(res);
  } catch (error) {
    return { error: errorMessage(error, "Relay request failed"), ok: false };
  }
}

function endpoint(channel: string, action: RelayAction) {
  const messages = `/channels/${encodeURIComponent(channel)}/messages`;
  if (action.action === "post") return { method: "POST", path: messages };
  const path = `${messages}/${encodeURIComponent(action.ts)}`;
  return { method: action.action === "edit" ? "PATCH" : "DELETE", path };
}

function requestBody(
  action: RelayAction,
  files: File[],
): { body: FormData | string; headers: Record<string, string> } {
  if (!files.length)
    return { body: JSON.stringify(action), headers: { "content-type": "application/json" } };
  const form = new FormData();
  form.append("payload", JSON.stringify(action));
  for (const file of files) form.append("files", file, file.name);
  return { body: form, headers: {} };
}

function sendOverHttp(token: string, channel: string, action: RelayAction, files: File[]) {
  const { method, path } = endpoint(channel, action);
  const { body, headers } = requestBody(action, files);
  return callRelay<{ ts?: string }>(token, method, path, body, headers);
}

function sendOverSlash(creds: Credentials, channel: string, action: RelayAction) {
  return callSlack(
    "chat.command",
    { channel, command: RELAY_COMMAND, text: JSON.stringify(action) },
    creds,
  );
}

async function sendRelayAction(ctx: RouteCtx, channel: string, action: RelayAction, files: File[]) {
  const { creds } = ctx;
  if (!creds) return errorResponse("not_configured", 401);
  if (creds.relayToken && relayUrl()) {
    const sent = await sendOverHttp(creds.relayToken, channel, action, files);
    if (sent.ok) return jsonResponse({ ts: sent.ts }, creds);
    if (sent.error !== "invalid_token" || files.length)
      return slackErrorResponse(sent, "relay", creds);
  }
  if (files.length) return errorResponse("relay_token_required", 400);
  const sent = await sendOverSlash(creds, channel, action);
  return sent.ok ? jsonResponse({}, creds) : slackErrorResponse(sent, "relay", creds);
}

export async function readRelayBody<T extends object>(
  ctx: RouteCtx,
): Promise<{ fields: T; files: File[] }> {
  if (!ctx.contentType?.startsWith("multipart/form-data")) {
    return { fields: await ctx.body.json<T>(), files: [] };
  }
  const form = await ctx.body.formData();
  const payload = form.get("payload");
  return {
    fields: JSON.parse(typeof payload === "string" ? payload : "{}"),
    files: form.getAll("files").filter((part) => part instanceof File),
  };
}

export function relayBroadcast(ctx: RouteCtx, channel: string, body: object, files: File[] = []) {
  return sendRelayAction(ctx, channel, { ...body, action: "post" }, files);
}

export function relayEdit(
  ctx: RouteCtx,
  channel: string,
  ts: string,
  body: object,
  files: File[] = [],
) {
  return sendRelayAction(ctx, channel, { ...body, action: "edit", ts }, files);
}

export function relayDelete(ctx: RouteCtx, channel: string, ts: string) {
  return sendRelayAction(ctx, channel, { action: "delete", ts }, []);
}
