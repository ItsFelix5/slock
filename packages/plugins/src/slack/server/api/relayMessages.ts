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

function relayUrl() {
  return Bun.env.SLOCK_RELAY_URL?.replace(TRAILING_SLASHES, "") || undefined;
}

async function callRelay<T extends object>(
  method: string,
  path: string,
  body: FormData | string,
  headers: Record<string, string>,
): Promise<SlackReply<T>> {
  try {
    const res = await fetch(`${relayUrl()}${path}`, {
      body,
      headers,
      method,
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
    });
    return await parseSlackResponse<T>(res);
  } catch (error) {
    return { error: errorMessage(error, "Relay request failed"), ok: false };
  }
}

function runRelayCommand(creds: Credentials, channel: string, request: object) {
  return callSlack(
    "chat.command",
    { channel, command: RELAY_COMMAND, text: JSON.stringify(request) },
    creds,
  );
}

async function relayToken(creds: Credentials, channel: string) {
  const nonce = crypto.randomUUID();
  const asked = await runRelayCommand(creds, channel, { action: "token", nonce });
  if (!asked.ok) return asked;
  const json = { "content-type": "application/json" };
  return callRelay<{ token: string }>("POST", "/token", JSON.stringify({ nonce }), json);
}

async function sendWithFiles(
  creds: Credentials,
  channel: string,
  action: RelayAction,
  files: File[],
) {
  const issued = await relayToken(creds, channel);
  if (!issued.ok) return issued;
  const form = new FormData();
  form.append("payload", JSON.stringify(action));
  for (const file of files) form.append("files", file, file.name);
  const messages = `/channels/${encodeURIComponent(channel)}/messages`;
  const [method, path] =
    action.action === "post"
      ? ["POST", messages]
      : ["PATCH", `${messages}/${encodeURIComponent(action.ts)}`];
  return callRelay<{ ts?: string }>(method, path, form, {
    authorization: `Bearer ${issued.token}`,
  });
}

async function sendRelayAction(ctx: RouteCtx, channel: string, action: RelayAction, files: File[]) {
  const { creds } = ctx;
  if (!creds) return errorResponse("not_configured", 401);
  if (!files.length) {
    const sent = await runRelayCommand(creds, channel, action);
    return sent.ok ? jsonResponse({}, creds) : slackErrorResponse(sent, "relay", creds);
  }
  if (!relayUrl()) return errorResponse("relay_not_configured", 400);
  const sent = await sendWithFiles(creds, channel, action, files);
  return sent.ok ? jsonResponse({ ts: sent.ts }, creds) : slackErrorResponse(sent, "relay", creds);
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
